# SecretRef Migration Implementation Plan

## Overview

This document outlines the complete implementation plan for migrating the SecureTest domain to use SecretRef protection while maintaining backward compatibility and ensuring a smooth transition.

## Current Architecture State

### Data Flow Layers

```
API Layer (HTTP)
├── CreateSecureTestRequest (plaintext strings)
└── DetailSecureTestResponse (plaintext strings)
          ↓
Application Layer (Services)
├── CreateSecureTestProps (plaintext strings) ← NEEDS MAPPING
└── SecureTestProps (SecretRef objects) ← TARGET DOMAIN MODEL
          ↓
Domain Layer (Entities/Aggregates)
├── SecureTestDomainState (value objects, original field names)
└── SecureTestSnapshotProps (strings, original field names)
          ↓
Infrastructure Layer (Persistence)
└── Database/Redis (strings, original field names)
```

### Field Mapping Matrix

| Layer                   | signingSecret              | username              | password              | Notes                  |
| ----------------------- | -------------------------- | --------------------- | --------------------- | ---------------------- |
| API Request             | `string?`                  | `string?`             | `string?`             | Backward compatible    |
| API Response            | `string?`                  | `string?`             | `string?`             | Backward compatible    |
| Application Props (New) | `SecretRef?`               | `SecretRef?`          | `SecretRef?`          | Target security model  |
| Domain State            | `SecureTestSigningSecret?` | `SecureTestUsername?` | `SecureTestPassword?` | Value objects          |
| Snapshot Props          | `string?`                  | `string?`             | `string?`             | Persistence compatible |

## Implementation Plan

### Phase 1: Application Service Layer Mapping

#### 1.1 Create SecretRef Mapping Service

**File:** `src/contexts/notification/webhook-config/secure-test/application/services/secure-test-secret-mapping.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Result, ok, err } from '@gs/core';
import { DomainError } from 'src/shared/domain';
import { CreateSecureTestProps } from '../../domain/props';
import { SecureTestProps } from '../../domain/props';
import { SecureTestSecretRefFactory } from '../../domain/value-objects';

/**
 * SecureTestSecretMappingService
 *
 * Responsible for converting between different data models in the SecureTest domain.
 * Handles the mapping from plaintext API props to SecretRef-protected domain props.
 */
@Injectable()
export class SecureTestSecretMappingService {
  /**
   * Convert API request props to domain props with SecretRef protection
   *
   * This method creates SecretRef instances from plaintext values by:
   * 1. Storing the plaintext values in Doppler (via SecretRef creation)
   * 2. Creating SecretRef instances that point to the stored secrets
   * 3. Returning SecureTestProps with no plaintext exposure
   */
  async mapCreatePropsToSecureProps(
    createProps: CreateSecureTestProps,
    context: {
      tenantId: string;
      namespace: string;
      requestId: string;
    },
  ): Promise<Result<SecureTestProps, DomainError>> {
    try {
      const secretConfig = {
        tenant: context.tenantId,
        namespace: context.namespace,
        version: 'latest',
      };

      // Map basic fields (no conversion needed)
      const baseProps: Pick<
        SecureTestProps,
        'id' | 'name' | 'description' | 'type' | 'signatureAlgorithm'
      > = {
        id: createProps.id,
        name: createProps.name,
        description: createProps.description,
        type: createProps.type,
        signatureAlgorithm: createProps.signatureAlgorithm,
      };

      // Create SecretRef instances for sensitive fields
      const secureProps: SecureTestProps = {
        ...baseProps,
        signingSecretRef: createProps.signingSecret
          ? SecureTestSecretRefFactory.createSigningSecretRef(
              secretConfig.tenant,
              secretConfig.namespace,
              `${createProps.id}-signing-secret`,
              secretConfig.version,
            )
          : undefined,
        usernameRef: createProps.username
          ? SecureTestSecretRefFactory.createAuthSecretRef(
              secretConfig.tenant,
              secretConfig.namespace,
              'username',
              `${createProps.id}-username`,
              secretConfig.version,
            )
          : undefined,
        passwordRef: createProps.password
          ? SecureTestSecretRefFactory.createAuthSecretRef(
              secretConfig.tenant,
              secretConfig.namespace,
              'password',
              `${createProps.id}-password`,
              secretConfig.version,
            )
          : undefined,
      };

      return ok(secureProps);
    } catch (error) {
      return err(
        new DomainError(
          'SECRETREF_MAPPING_FAILED',
          `Failed to map CreateSecureTestProps to SecureTestProps: ${error.message}`,
          { createProps, context },
        ),
      );
    }
  }

  /**
   * Convert domain props back to API response format
   *
   * NOTE: This method should NOT resolve SecretRef values to plaintext.
   * Instead, it should return safe representations or omit sensitive fields.
   */
  mapSecurePropsToResponseProps(secureProps: SecureTestProps): Pick<
    CreateSecureTestProps,
    'id' | 'name' | 'description' | 'type' | 'signatureAlgorithm'
  > & {
    hasSigningSecret: boolean;
    hasUsername: boolean;
    hasPassword: boolean;
  } {
    return {
      id: secureProps.id,
      name: secureProps.name,
      description: secureProps.description,
      type: secureProps.type,
      signatureAlgorithm: secureProps.signatureAlgorithm,
      // Security: Return existence flags instead of actual values
      hasSigningSecret: !!secureProps.signingSecretRef,
      hasUsername: !!secureProps.usernameRef,
      hasPassword: !!secureProps.passwordRef,
    };
  }
}
```

#### 1.2 Update Application Use Cases

**File:** `src/contexts/notification/webhook-config/secure-test/application/use-cases/create-secure-test.use-case.ts`

```typescript
// Add to constructor
constructor(
  // ... existing dependencies
  private readonly secretMappingService: SecureTestSecretMappingService,
) {}

// Update execute method
async execute(request: {
  props: CreateSecureTestProps;
  context: ActorContext;
}): Promise<Result<DetailSecureTestResponse, DomainError>> {
  // Step 1: Convert API props to domain props with SecretRef protection
  const securePropsResult = await this.secretMappingService.mapCreatePropsToSecureProps(
    request.props,
    {
      tenantId: request.context.tenantId,
      namespace: 'notification.webhook-config.secure-test',
      requestId: request.context.requestId,
    }
  );

  if (!securePropsResult.ok) {
    return err(securePropsResult.error);
  }

  // Step 2: Create domain aggregate using SecretRef-protected props
  // ... rest of the implementation
}
```

### Phase 2: Domain-to-Persistence Mapping

#### 2.1 Create Domain State Mapper

**File:** `src/contexts/notification/webhook-config/secure-test/infrastructure/mappers/secure-test-domain-mapper.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Result, ok, err } from '@gs/core';
import { DomainError } from 'src/shared/domain';
import { SecureTestDomainState } from '../../domain/state';
import { SecureTestSnapshotProps } from '../../domain/props';
import { SecureTestProps } from '../../domain/props';
import { SecureTestSecretService } from '../../domain/services';

/**
 * SecureTestDomainMapper
 *
 * Handles mapping between different domain representations:
 * - SecureTestProps (SecretRef) ↔ SecureTestDomainState (Value Objects)
 * - SecureTestDomainState (Value Objects) ↔ SecureTestSnapshotProps (Strings)
 */
@Injectable()
export class SecureTestDomainMapper {
  constructor(private readonly secretService: SecureTestSecretService) {}

  /**
   * Convert SecretRef props to domain state with resolved values
   *
   * This method resolves SecretRef instances to actual values and creates
   * the appropriate value objects for the domain state.
   */
  async mapSecurePropsToState(
    secureProps: SecureTestProps,
    tenantId: string,
  ): Promise<Result<Partial<SecureTestDomainState>, DomainError>> {
    try {
      // Resolve all secret references concurrently
      const [signingSecret, username, password] = await Promise.allSettled([
        secureProps.signingSecretRef
          ? this.secretService.resolveSigningSecret(secureProps, tenantId)
          : Promise.resolve(null),
        secureProps.usernameRef
          ? this.secretService
              .resolveAuthCredentials(secureProps, tenantId)
              .then((creds) => creds.username)
          : Promise.resolve(null),
        secureProps.passwordRef
          ? this.secretService
              .resolveAuthCredentials(secureProps, tenantId)
              .then((creds) => creds.password)
          : Promise.resolve(null),
      ]);

      // Create value objects from resolved values
      const domainState: Partial<SecureTestDomainState> = {
        // Note: Only include resolved secrets, basic fields handled elsewhere
        signingSecret:
          signingSecret.status === 'fulfilled' && signingSecret.value
            ? SecureTestSigningSecret.from(signingSecret.value).unwrapOr(
                undefined,
              )
            : undefined,
        username:
          username.status === 'fulfilled' && username.value
            ? SecureTestUsername.from(username.value).unwrapOr(undefined)
            : undefined,
        password:
          password.status === 'fulfilled' && password.value
            ? SecureTestPassword.from(password.value).unwrapOr(undefined)
            : undefined,
      };

      return ok(domainState);
    } catch (error) {
      return err(
        new DomainError(
          'DOMAIN_MAPPING_FAILED',
          `Failed to map SecureTestProps to domain state: ${error.message}`,
          { secureProps, tenantId },
        ),
      );
    }
  }

  /**
   * Convert domain state to snapshot props for persistence
   *
   * This extracts the string values from value objects for database storage.
   */
  mapDomainStateToSnapshot(
    domainState: SecureTestDomainState,
  ): SecureTestSnapshotProps {
    return {
      id: domainState.id.value,
      name: domainState.name.value,
      description: domainState.description?.value,
      type: domainState.type.value,
      signingSecret: domainState.signingSecret?.value,
      signatureAlgorithm: domainState.signatureAlgorithm?.value,
      username: domainState.username?.value,
      password: domainState.password?.value,
      createdAt: domainState.createdAt.value,
      updatedAt: domainState.updatedAt.value,
      version: domainState.version.value,
    };
  }

  /**
   * Convert snapshot props back to domain state
   *
   * This recreates value objects from persisted string values.
   */
  mapSnapshotToDomainState(
    snapshot: SecureTestSnapshotProps,
  ): Result<SecureTestDomainState, DomainError> {
    // Implementation matches existing fromSnapshot logic in SecureTestEntity
    // ... (use existing implementation from entity)
  }
}
```

#### 2.2 Update Repository Layer

**File:** `src/contexts/notification/webhook-config/secure-test/infrastructure/repositories/secure-test-redis-writer.repository.ts`

```typescript
// Add to constructor
constructor(
  // ... existing dependencies
  private readonly domainMapper: SecureTestDomainMapper,
) {}

// Update save method
async save(aggregate: SecureTestAggregate): Promise<Result<void, DomainError>> {
  // Convert domain state to snapshot for persistence
  const domainState = aggregate.toDomainState();
  const snapshot = this.domainMapper.mapDomainStateToSnapshot(domainState);

  // Use snapshot for Redis storage
  // ... rest of implementation
}
```

### Phase 3: Migration Strategy & Rollout Plan

#### 3.1 Feature Flag Configuration

**File:** `src/contexts/notification/webhook-config/secure-test/application/config/secretref-migration.config.ts`

```typescript
export interface SecretRefMigrationConfig {
  enabled: boolean;
  tenants: string[];
  rolloutPercentage: number;
  fallbackToLegacy: boolean;
}

export const getSecretRefMigrationConfig = (): SecretRefMigrationConfig => ({
  enabled: process.env.SECRETREF_MIGRATION_ENABLED === 'true',
  tenants: (process.env.SECRETREF_MIGRATION_TENANTS || '')
    .split(',')
    .filter(Boolean),
  rolloutPercentage: parseInt(
    process.env.SECRETREF_MIGRATION_ROLLOUT || '0',
    10,
  ),
  fallbackToLegacy: process.env.SECRETREF_MIGRATION_FALLBACK !== 'false',
});
```

#### 3.2 Hybrid Service Implementation

**File:** `src/contexts/notification/webhook-config/secure-test/application/services/secure-test-hybrid.service.ts`

```typescript
@Injectable()
export class SecureTestHybridService {
  constructor(
    private readonly secretMappingService: SecureTestSecretMappingService,
    private readonly legacyService: SecureTestLegacyService, // Existing service
  ) {}

  /**
   * Create SecureTest with migration strategy
   *
   * Routes to SecretRef or legacy implementation based on configuration
   */
  async create(
    request: CreateSecureTestProps,
    context: ActorContext,
  ): Promise<Result<DetailSecureTestResponse, DomainError>> {
    const config = getSecretRefMigrationConfig();

    const shouldUseSecretRef = this.shouldUseSecretRef(
      context.tenantId,
      config,
    );

    if (shouldUseSecretRef) {
      try {
        return await this.createWithSecretRef(request, context);
      } catch (error) {
        if (config.fallbackToLegacy) {
          console.warn('SecretRef creation failed, falling back to legacy', {
            error,
          });
          return await this.legacyService.create(request, context);
        }
        throw error;
      }
    }

    return await this.legacyService.create(request, context);
  }

  private shouldUseSecretRef(
    tenantId: string,
    config: SecretRefMigrationConfig,
  ): boolean {
    if (!config.enabled) return false;

    // Tenant whitelist
    if (config.tenants.length > 0 && !config.tenants.includes(tenantId)) {
      return false;
    }

    // Percentage rollout
    if (config.rolloutPercentage === 0) return false;
    if (config.rolloutPercentage === 100) return true;

    // Hash-based consistent rollout
    const hash = this.hashTenantId(tenantId);
    return hash % 100 < config.rolloutPercentage;
  }

  private hashTenantId(tenantId: string): number {
    // Simple hash function for consistent rollout
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      const char = tenantId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private async createWithSecretRef(
    request: CreateSecureTestProps,
    context: ActorContext,
  ): Promise<Result<DetailSecureTestResponse, DomainError>> {
    // Implementation using SecretRef mapping service
    // ...
  }
}
```

### Phase 4: API Contract Evolution

#### 4.1 Versioned API Responses

**File:** `src/contexts/notification/webhook-config/secure-test/application/dtos/secure-test-detail-v2.response.ts`

```typescript
/**
 * V2 API Response - Enhanced Security
 *
 * This version does not expose plaintext secrets in API responses.
 * Instead, it provides metadata about secret configuration.
 */
export class DetailSecureTestV2Response {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  type: SecureTestTypeValue;

  @ApiProperty({ required: false })
  signatureAlgorithm?: SecureTestSignatureAlgorithmValue;

  // Security Enhancement: Don't expose actual secrets
  @ApiProperty({
    description: 'Indicates if signing secret is configured',
    required: false,
  })
  hasSigningSecret?: boolean;

  @ApiProperty({
    description: 'Signing secret configuration metadata',
    required: false,
  })
  signingSecretConfig?: {
    keyReference: string;
    version: string;
    lastRotated?: string;
  };

  @ApiProperty({
    description: 'Indicates if username is configured',
    required: false,
  })
  hasUsername?: boolean;

  @ApiProperty({
    description: 'Indicates if password is configured',
    required: false,
  })
  hasPassword?: boolean;

  @ApiProperty({
    description: 'Authentication configuration metadata',
    required: false,
  })
  authConfig?: {
    usernameReference?: string;
    passwordReference?: string;
    version: string;
    lastRotated?: string;
  };
}
```

#### 4.2 Backward Compatible Controllers

**File:** `src/contexts/notification/webhook-config/secure-test/interface/http/controllers/secure-test-v2.controller.ts`

```typescript
@ApiTags('SecureTest V2 - Enhanced Security')
@Controller('v2/notification/webhook-config/secure-test')
export class SecureTestV2Controller {
  @Post()
  @ApiOperation({
    summary: 'Create SecureTest with enhanced security',
    description:
      'Creates a SecureTest using SecretRef for secure secret management',
  })
  @ApiResponse({
    status: 201,
    description: 'SecureTest created successfully',
    type: DetailSecureTestV2Response,
  })
  async create(
    @Body() request: CreateSecureTestRequest,
    @ActorContext() context: ActorContext,
  ): Promise<Result<DetailSecureTestV2Response, DomainError>> {
    // Use hybrid service for gradual migration
    return await this.hybridService.createV2(request, context);
  }
}
```

## Implementation Timeline

### Week 1-2: Foundation

- [ ] Implement SecureTestSecretMappingService
- [ ] Create SecureTestDomainMapper
- [ ] Add feature flag configuration
- [ ] Unit tests for mapping services

### Week 3-4: Integration

- [ ] Update use cases to use mapping services
- [ ] Implement SecureTestHybridService
- [ ] Update repository layer
- [ ] Integration tests

### Week 5-6: API Evolution

- [ ] Create V2 API responses
- [ ] Implement V2 controllers
- [ ] Add backward compatibility middleware
- [ ] API contract tests

### Week 7-8: Migration & Monitoring

- [ ] Deploy with feature flags disabled
- [ ] Gradual tenant rollout (10% → 50% → 100%)
- [ ] Monitor error rates and performance
- [ ] Rollback procedures if needed

## Testing Strategy

### Unit Tests

```typescript
describe('SecureTestSecretMappingService', () => {
  it('should convert CreateSecureTestProps to SecureTestProps', async () => {
    // Test mapping with all fields
    // Test mapping with optional fields
    // Test error handling
  });
});
```

### Integration Tests

```typescript
describe('SecureTest Migration Integration', () => {
  it('should work end-to-end with SecretRef', async () => {
    // Create via API → Store with SecretRef → Retrieve → Verify
  });

  it('should fallback to legacy on SecretRef failure', async () => {
    // Test fallback mechanism
  });
});
```

### Performance Tests

```typescript
describe('SecretRef Performance', () => {
  it('should not significantly impact response times', async () => {
    // Benchmark legacy vs SecretRef implementations
  });
});
```

## Monitoring & Observability

### Metrics to Track

```typescript
// Feature flag usage
secretref_migration_enabled_total;
secretref_migration_tenant_rollout_percentage;

// Performance impact
secretref_creation_duration_ms;
secretref_resolution_duration_ms;
legacy_creation_duration_ms;

// Error rates
secretref_mapping_errors_total;
secretref_fallback_triggered_total;
secretref_resolution_failures_total;

// Business metrics
secure_tests_created_with_secretref_total;
secure_tests_created_with_legacy_total;
```

### Alerting Rules

```yaml
# High error rate in SecretRef operations
- alert: SecretRefHighErrorRate
  expr: rate(secretref_mapping_errors_total[5m]) > 0.1

# Fallback triggered frequently
- alert: SecretRefFallbackHigh
  expr: rate(secretref_fallback_triggered_total[5m]) > 0.05
```

## Rollback Strategy

### Immediate Rollback (< 1 hour)

1. Set `SECRETREF_MIGRATION_ENABLED=false`
2. Set `SECRETREF_MIGRATION_ROLLOUT=0`
3. Restart services
4. Verify legacy functionality

### Data Rollback (if needed)

1. SecretRef data remains in Doppler (no data loss)
2. Database snapshots still use original field names
3. No schema changes required
4. Legacy services continue to work

### Gradual Rollback

1. Reduce rollout percentage: 100% → 50% → 10% → 0%
2. Monitor error rates at each step
3. Keep SecretRef infrastructure for future retry

## Risk Mitigation

### Technical Risks

- **SecretRef service failure**: Implement circuit breaker and fallback
- **Performance degradation**: Load test and monitor latency
- **Data consistency**: Use transactions and eventual consistency patterns

### Business Risks

- **Customer impact**: Gradual rollout with immediate rollback capability
- **Security regression**: Comprehensive security testing
- **Compliance issues**: Legal review of data handling changes

## Success Criteria

### Technical

- [ ] Zero data loss during migration
- [ ] < 10% performance degradation
- [ ] < 0.1% error rate increase
- [ ] 100% backward API compatibility

### Security

- [ ] No plaintext secrets in logs/events
- [ ] Proper tenant isolation verified
- [ ] Secret rotation capability tested
- [ ] Audit logging functional

### Business

- [ ] Seamless user experience
- [ ] No customer complaints
- [ ] Enhanced security posture
- [ ] Foundation for future security features

---

This implementation plan provides a comprehensive, phased approach to completing the SecretRef migration while maintaining system stability and backward compatibility.
