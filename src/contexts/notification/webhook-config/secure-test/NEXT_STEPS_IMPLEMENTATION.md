# SecretRef Migration - Next Steps Implementation Guide

## 🎯 Current Status Summary

✅ **Phase 0: Foundation Completed**

- TypeScript compilation errors resolved across all SecretRef migration files
- Core implementation architecture established with proper patterns
- Hybrid service pattern implemented for gradual rollout
- Configuration management system with feature flags ready
- Import patterns aligned with shared logging and error handling systems

---

## 🚀 Next Steps - Priority Implementation Order

### **Immediate Actions (Next 1-2 Days)**

#### 1. Fix Import Path Integration

**Files to Update:**

- `secure-test-secret-mapping.service.ts`
- `secure-test-hybrid.service.ts`

**Tasks:**

```typescript
// Update SecretMappingContext to use proper ActorContext
interface SecretMappingContext {
  tenantId: string;
  namespace: string;
  requestId: string; // Add this field to ActorContext or use UUID generation
  userId?: string;
}

// Add requestId to ActorContext or generate UUID:
const mappingContext: SecretMappingContext = {
  tenantId: context.tenant,
  namespace: 'notification.webhook-config.secure-test',
  requestId: crypto.randomUUID(), // Generate unique request ID
  userId: context.userId,
};
```

#### 2. Domain Integration Fixes

**Priority:** HIGH
**Files:** All SecretRef implementation files

**Required Changes:**

```typescript
// Fix SecretRef property access in mapping service
// Current: secureProps.signingSecretRef?.ref.raw (BROKEN)
// Correct: secureProps.signingSecretRef?.ref (SecretRef interface)

// Update mapping to match actual SecretRef structure:
secretReferences: {
  signingSecretRef: secureProps.signingSecretRef?.raw ||
                   JSON.stringify(secureProps.signingSecretRef),
  usernameRef: secureProps.usernameRef?.raw ||
               JSON.stringify(secureProps.usernameRef),
  passwordRef: secureProps.passwordRef?.raw ||
               JSON.stringify(secureProps.passwordRef),
}
```

### **Week 1: Core Integration**

#### 3. Module Registration & Dependency Injection

**Priority:** HIGH
**Estimated Time:** 1-2 days

**Create NestJS Module:**

```typescript
// File: src/contexts/notification/webhook-config/secure-test/secretref-migration.module.ts
@Module({
  imports: [
    SecureTestModule, // Existing module
    SharedLoggingModule,
    SharedErrorsModule,
  ],
  providers: [
    SecureTestSecretMappingService,
    SecureTestHybridService,
    // Import existing services
  ],
  exports: [
    SecureTestHybridService, // Main service for use cases
  ],
})
export class SecretRefMigrationModule {}
```

**Integration Points:**

```typescript
// Update existing use cases to inject hybrid service
@Injectable()
export class CreateSecureTestUseCase {
  constructor(
    // Keep existing dependencies for legacy path
    private readonly legacyService: ExistingSecureTestService,
    // Add new hybrid service for migration
    private readonly hybridService: SecureTestHybridService,
  ) {}

  async execute(
    request,
    context,
  ): Promise<Result<DetailSecureTestResponse, DomainError>> {
    // Route through hybrid service
    return await this.hybridService.create(request.props, context);
  }
}
```

#### 4. Environment Configuration Setup

**Priority:** HIGH
**Estimated Time:** 1 day

**Environment Variables:**

```bash
# Development
SECRETREF_MIGRATION_ENABLED=false  # Start disabled
SECRETREF_MIGRATION_TENANTS=        # Comma-separated list
SECRETREF_MIGRATION_ROLLOUT=0       # Percentage (0-100)
SECRETREF_MIGRATION_FALLBACK=true   # Always enabled in prod

# Staging
SECRETREF_MIGRATION_ENABLED=true
SECRETREF_MIGRATION_ROLLOUT=10      # Start with 10%
SECRETREF_MIGRATION_FALLBACK=true

# Production
SECRETREF_MIGRATION_ENABLED=false  # Deploy disabled first
SECRETREF_MIGRATION_ROLLOUT=0
SECRETREF_MIGRATION_FALLBACK=true
```

**Configuration Validation:**

```typescript
// Add to app startup
const config = getSecretRefMigrationConfig();
const validation = validateSecretRefMigrationConfig(config);

if (!validation.valid) {
  throw new Error(`Invalid SecretRef config: ${validation.errors.join(', ')}`);
}

// Log configuration summary on startup
console.log('SecretRef Migration Config:', getSecretRefConfigSummary());
```

### **Week 2: Testing & Validation**

#### 5. Comprehensive Test Suite

**Priority:** HIGH
**Estimated Time:** 3-4 days

**Unit Tests:**

```typescript
// Test files to create:
-secure -
  test -
  secret -
  mapping.service.spec.ts -
  secure -
  test -
  hybrid.service.spec.ts -
  secretref -
  migration.config.spec.ts;

// Key test scenarios:
describe('SecureTestSecretMappingService', () => {
  it('should map CreateProps to SecretRef props', async () => {
    // Test successful mapping
    // Test missing context
    // Test SecretRef creation failure
  });

  it('should map SecretRef props to safe response metadata', () => {
    // Test metadata extraction without exposing secrets
    // Verify no plaintext in response
  });
});

describe('SecureTestHybridService', () => {
  it('should route to SecretRef when enabled for tenant', async () => {
    // Test tenant whitelist routing
    // Test percentage-based routing
    // Test fallback on failure
  });

  it('should fallback to legacy on SecretRef failure', async () => {
    // Test circuit breaker behavior
    // Test error handling
  });
});
```

**Integration Tests:**

```typescript
describe('SecretRef End-to-End Integration', () => {
  it('should create SecureTest with SecretRef end-to-end', async () => {
    // API Request → Mapping → Domain → Persistence → Response
    // Verify no plaintext secrets in any layer
    // Test secret resolution in domain operations
  });

  it('should maintain backward compatibility', async () => {
    // Test existing API contracts unchanged
    // Verify legacy functionality preserved
  });
});
```

#### 6. Domain Value Object Integration

**Priority:** MEDIUM-HIGH
**Estimated Time:** 2-3 days

**Missing Components:**

```typescript
// Connect SecretRef to existing domain value objects
// File: secure-test-secret.service.ts - UPDATE NEEDED

class SecureTestSecretService {
  async resolveSigningSecret(
    secureProps: SecureTestProps,
    tenantId: string,
  ): Promise<string> {
    if (!secureProps.signingSecretRef) return null;

    // Integrate with existing SecretRef resolution service
    const resolvedSecret = await this.secretRefService.resolve(
      secureProps.signingSecretRef,
      { tenant: tenantId },
    );

    return resolvedSecret.value;
  }
}

// Update domain aggregate to use SecretRef-resolved values
// File: secure-test.aggregate.ts - INTEGRATION NEEDED
```

### **Week 3-4: Production Readiness**

#### 7. Monitoring & Observability Implementation

**Priority:** HIGH for Production
**Estimated Time:** 2-3 days

**Metrics Implementation:**

```typescript
// Add to hybrid service
class SecureTestHybridService {
  private readonly metrics = {
    secretRefAttempts: 0,
    secretRefSuccesses: 0,
    legacyFallbacks: 0,
    // ... existing metrics
  };

  // Expose metrics endpoint
  getMigrationMetrics() {
    return {
      ...this.metrics,
      successRate: (this.metrics.secretRefSuccesses / this.metrics.secretRefAttempts * 100) || 0,
      fallbackRate: (this.metrics.legacyFallbacks / this.metrics.totalRequests * 100) || 0,
    };
  }
}

// Health check endpoint
@Get('health/secretref-migration')
async getSecretRefHealth() {
  return await this.hybridService.healthCheck();
}
```

**Alerting Setup:**

```yaml
# Prometheus alerts
groups:
  - name: secretref_migration
    rules:
      - alert: SecretRefHighErrorRate
        expr: rate(secretref_errors_total[5m]) > 0.05
        labels:
          severity: warning
        annotations:
          summary: High SecretRef error rate detected

      - alert: SecretRefFallbackHigh
        expr: rate(secretref_fallback_total[5m]) > 0.1
        labels:
          severity: critical
        annotations:
          summary: High SecretRef fallback rate - investigate immediately
```

#### 8. Deployment Pipeline Integration

**Priority:** MEDIUM-HIGH
**Estimated Time:** 2 days

**Deployment Strategy:**

```yaml
# CI/CD Pipeline updates needed:
deploy:
  steps:
    - name: Deploy with SecretRef disabled
      env:
        SECRETREF_MIGRATION_ENABLED: false
        SECRETREF_MIGRATION_ROLLOUT: 0

    - name: Run health checks
      script: |
        curl /health/secretref-migration
        curl /health # Existing health checks

    - name: Gradual rollout (if enabled)
      script: |
        # Enable for canary tenant first
        kubectl set env deployment/app SECRETREF_MIGRATION_TENANTS=canary-tenant
        kubectl set env deployment/app SECRETREF_MIGRATION_ENABLED=true

        # Monitor for 10 minutes
        sleep 600

        # Check error rates before proceeding
        if [[ $(curl /metrics | grep secretref_error_rate) < 0.01 ]]; then
          echo "Proceeding with wider rollout"
          kubectl set env deployment/app SECRETREF_MIGRATION_ROLLOUT=10
        fi
```

### **Future Enhancements (Week 5+)**

#### 9. Advanced Security Features

**Priority:** MEDIUM
**Estimated Time:** 1-2 weeks

- **Secret Rotation:** Implement automatic secret rotation
- **Audit Logging:** Enhanced audit trails for secret access
- **Encryption at Rest:** Additional encryption layers
- **Multi-Region Support:** Cross-region secret synchronization

#### 10. Performance Optimization

**Priority:** LOW-MEDIUM
**Estimated Time:** 1 week

- **Caching Layer:** Implement SecretRef resolution caching
- **Batch Operations:** Bulk secret operations
- **Connection Pooling:** Optimize Doppler connections

---

## 🔧 Implementation Checklist

### **Pre-Development Setup**

- [ ] Review current SecretRef infrastructure status
- [ ] Validate Doppler integration and permissions
- [ ] Set up development environment variables
- [ ] Create feature branch: `feature/secretref-migration-integration`

### **Development Phase**

- [ ] Fix import path issues in mapping service
- [ ] Update ActorContext integration in hybrid service
- [ ] Create NestJS module for service registration
- [ ] Implement comprehensive test suite
- [ ] Add monitoring and health check endpoints
- [ ] Update deployment configuration

### **Testing Phase**

- [ ] Unit test coverage > 90%
- [ ] Integration tests for end-to-end flows
- [ ] Performance benchmarking vs legacy implementation
- [ ] Security testing (no plaintext secret exposure)
- [ ] Load testing with SecretRef enabled

### **Deployment Phase**

- [ ] Deploy to staging with feature flags disabled
- [ ] Enable SecretRef for single test tenant
- [ ] Monitor metrics and error rates
- [ ] Gradual production rollout (10% → 25% → 50% → 100%)
- [ ] Document rollback procedures

### **Post-Deployment**

- [ ] Monitor success metrics for 1 week
- [ ] Collect performance data
- [ ] Security audit of implementation
- [ ] Create runbook for operations team

---

## 🚨 Critical Success Factors

1. **Zero Downtime:** Ensure hybrid pattern maintains service availability
2. **Data Integrity:** No data loss during migration
3. **Security:** No plaintext secrets in logs, databases, or API responses
4. **Performance:** < 10% performance degradation acceptable
5. **Rollback Ready:** Instant rollback capability via feature flags

## 📊 Success Metrics

### **Technical Metrics**

- Error rate < 0.1% increase
- Response time < 10% degradation
- 100% backward API compatibility
- Zero security incidents

### **Business Metrics**

- Zero customer complaints related to migration
- Enhanced security posture verification
- Compliance audit readiness
- Foundation for future security features established

---

**Next Immediate Action:** Start with fixing the import path issues and ActorContext integration, then proceed with NestJS module registration for proper dependency injection! 🚀
