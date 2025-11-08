# Event Encryption Factory Implementation Plan

## 📋 Overview

Implement a unified EventEncryptionFactory to replace scattered encryption logic across repositories with a consistent, type-safe, and extensible pattern.

## 🎯 Goals

- **Consistency**: Same encryption pattern across all writer repositories
- **Type Safety**: Compile-time validation of encryption configurations
- **Extensibility**: Easy to add new encryption types (env, custom, etc.)
- **Maintainability**: Centralize complex encryption logic
- **Developer Experience**: Simple, discoverable API
- **Symmetry**: Bidirectional encrypt/decrypt with same configurations
- **Strategy Pattern**: Consistent interface for all encryption strategies
- **Observability**: Rich metadata for monitoring and auditing

## 📐 Architecture

```
IEventEncryptionFactory (Interface)
├── encryptEvents<T>() - Bidirectional encryption
├── decryptEvents<T>() - Symmetric decryption with same config
├── createPIIConfig() - Static helper for PII configuration
└── createSecretConfig() - Static helper for SecretRef configuration

EncryptionStrategy (Interface)
├── encrypt<T>() - Strategy-specific encryption
├── decrypt<T>() - Strategy-specific decryption
└── getMetadata() - Rich observability metadata

Strategies Implementation
├── SecretRefStrategy - SecretRef encryption/decryption
├── PIIStrategy - PII compliance encryption/decryption
├── EnvStrategy - Environment variable encryption/decryption
├── HybridStrategy - Pipeline of multiple strategies
└── NoopStrategy - Pass-through for testing
```

## 🚀 Implementation Phases

### Phase 1: Foundation (1-2 days)

**Goal**: Create factory infrastructure and basic encryption types

#### 1.1 Create Factory Structure

- [x] ✅ `src/shared/infrastructure/encryption/event-encryption.factory.ts`
- [x] ✅ Define `EncryptionType` union ('noop', 'secret', 'doppler', 'pii', 'env', 'custom', 'hybrid')
- [ ] 🔄 **NEW**: Create `IEventEncryptionFactory` interface with bidirectional methods
- [ ] 🔄 **NEW**: Create `EncryptionStrategy` interface for consistent strategy contracts
- [ ] 🔄 **NEW**: Define enriched `EncryptionMetadata` interface for observability
- [x] ✅ Create configuration interfaces for each type
- [ ] 🔄 **NEW**: Add `CompositeEncryptionConfig` for hybrid pipelines
- [x] ✅ Implement factory class with strategy pattern

#### 1.2 Implement Core Encryption Strategies

- [ ] 🔄 **NEW**: `NoopStrategy` - Pass-through with encrypt/decrypt symmetry
- [ ] 🔄 **NEW**: `SecretRefStrategy` - Bidirectional SecretRef handling
- [ ] 🔄 **NEW**: `PIIStrategy` - Bidirectional PII compliance encryption
- [ ] 🔄 **NEW**: `EnvStrategy` - Environment variable encryption/decryption
- [ ] 🔄 **NEW**: `HybridStrategy` - Pipeline execution for multiple strategies
- [ ] 🔄 **NEW**: Each strategy implements `EncryptionStrategy` interface

#### 1.3 Module Registration & Developer Ergonomics

- [ ] 🔄 **NEW**: Create `EventEncryptionModule.register()` dynamic module
- [ ] 🔄 Register within existing `SecretRefModule` to avoid circular dependencies
- [ ] 🔄 Export factory for use in repositories
- [ ] 🔄 **NEW**: Add static helper methods for configuration:
  - `EventEncryptionFactory.createPIIConfig()`
  - `EventEncryptionFactory.createSecretConfig()`
  - `EventEncryptionFactory.createHybridConfig()`

### Phase 2: Repository Migration (2-3 days)

**Goal**: Migrate existing repositories to use the factory

#### 2.1 SecureTest Repository Migration

- [ ] 🔄 Update `secure-test-kurrentdb-writer.repository.ts` for encryption
- [ ] 🔄 **NEW**: Update query/reader repositories for decryption symmetry
- [ ] 🔄 Replace direct `EventEncryptionService` with factory
- [ ] 🔄 **NEW**: Use static helper for cleaner configuration:

  ```typescript
  // Writer Repository - Encryption
  const config = EventEncryptionFactory.createSecretConfig(
    ['signingSecret', 'username', 'password'],
    { signingSecret: 'signing', username: 'auth', password: 'auth' },
  );
  const { events: eventsToStore } = await this.encryptionFactory.encryptEvents(
    events,
    actor,
    config,
  );

  // Query/Reader Repository - Decryption
  const { events: decryptedEvents } =
    await this.encryptionFactory.decryptEvents(events, actor, config);
  ```

#### 2.2 Webhook Repository Migration

- [ ] 🔄 Update `webhook-kurrentdb-writer.repository.ts` for encryption
- [ ] 🔄 **NEW**: Update webhook query/reader repositories for decryption symmetry
- [ ] 🔄 Replace complex PII encryption loop with factory
- [ ] 🔄 **NEW**: Use static helper for cleaner configuration:

  ```typescript
  // Writer Repository - PII Encryption
  const config = EventEncryptionFactory.createPIIConfig({
    domain: 'webhook-config',
    tenant: actor.tenant,
  });
  const { events: eventsToStore } = await this.encryptionFactory.encryptEvents(
    events,
    actor,
    config,
  );

  // Query/Reader Repository - PII Decryption
  const { events: decryptedEvents } =
    await this.encryptionFactory.decryptEvents(events, actor, config);
  ```

#### 2.3 Remove Old Dependencies

- [ ] 🔄 Remove direct `EventEncryptionService` injection from SecureTest repository
- [ ] 🔄 Remove direct `PIIClassificationService` and `PIIEncryptionAdapter` from Webhook repository
- [ ] 🔄 Add `EventEncryptionFactory` injection to both repositories

### Phase 3: Testing & Validation (1-2 days)

**Goal**: Ensure all encryption functionality works correctly

#### 3.1 Unit Tests

- [ ] 🔄 Test factory with all encryption types
- [ ] 🔄 **NEW**: Test bidirectional encrypt/decrypt symmetry for all strategies
- [ ] 🔄 **NEW**: Golden data tests - ensure encrypted payloads remain decryptable after updates
- [ ] 🔄 **NEW**: Round-trip integrity checks - encrypt → decrypt → assert deep equality
- [ ] 🔄 Test configuration validation and type safety
- [ ] 🔄 Test enriched metadata generation for observability
- [ ] 🔄 Test error handling for unsupported types
- [ ] 🔄 **NEW**: Mock Key Management for Doppler/env isolation

#### 3.2 Integration Tests

- [ ] 🔄 **NEW**: Test full encrypt (writer) → decrypt (reader) cycles for all strategies
- [ ] 🔄 Test SecureTest repository bidirectional encryption/decryption
- [ ] 🔄 Test Webhook repository bidirectional PII encryption/decryption
- [ ] 🔄 **NEW**: Test hybrid pipeline strategies (pii + kms)
- [ ] 🔄 Verify EventStore contains properly encrypted data
- [ ] 🔄 Verify read repositories can decrypt data using same configuration

#### 3.3 Functional Testing

- [ ] 🔄 Run existing test suite to ensure no regressions
- [ ] 🔄 Test with `node test-fetch-secure-test.js`
- [ ] 🔄 Verify encryption metrics and logging

### Phase 4: Extensions & Polish (1-2 days)

**Goal**: Add new encryption types and improve developer experience

#### 4.1 Environment Variable Encryption

- [ ] 🔄 Implement `handleEnvEncryption()` for configuration secrets
- [ ] 🔄 Create `EnvEncryptionConfig` interface
- [ ] 🔄 Add tests for environment variable encryption

#### 4.2 Developer Experience Improvements

- [ ] 🔄 Add comprehensive JSDoc documentation
- [ ] 🔄 Create migration guide for other repositories
- [ ] 🔄 Add factory usage examples and best practices
- [ ] 🔄 Improve error messages and validation

#### 4.3 Monitoring & Observability

- [ ] 🔄 Add metrics collection for encryption operations
- [ ] 🔄 Add structured logging with encryption metadata
- [ ] 🔄 Create dashboard queries for encryption monitoring

## 📁 File Structure

```
src/shared/infrastructure/encryption/
├── interfaces/
│   ├── event-encryption-factory.interface.ts    # IEventEncryptionFactory interface
│   ├── encryption-strategy.interface.ts         # EncryptionStrategy interface
│   └── encryption-metadata.interface.ts         # Enriched metadata types
├── event-encryption.factory.ts                  # Main factory implementation
├── event-encryption.module.ts                   # NestJS dynamic module
├── encryption-config.types.ts                   # Configuration type definitions
├── strategies/                                  # Strategy implementations
│   ├── noop.strategy.ts                        # Pass-through strategy
│   ├── secret-ref.strategy.ts                  # SecretRef encryption/decryption
│   ├── pii.strategy.ts                         # PII encryption/decryption
│   ├── env.strategy.ts                         # Environment variable encryption
│   ├── hybrid.strategy.ts                      # Pipeline of multiple strategies
│   └── strategy.registry.ts                    # Strategy registration and lookup
├── helpers/
│   ├── config.helpers.ts                       # Static configuration helpers
│   └── validation.helpers.ts                   # Configuration validation
├── example-usage.ts                            # Usage examples and patterns
└── __tests__/                                  # Test files
    ├── event-encryption.factory.spec.ts
    ├── strategies/
    │   ├── secret-ref.strategy.spec.ts
    │   ├── pii.strategy.spec.ts
    │   ├── hybrid.strategy.spec.ts
    │   └── golden-data/                         # Golden data test fixtures
    │       ├── secret-ref.fixtures.ts
    │       └── pii.fixtures.ts
    └── integration/
        ├── round-trip.spec.ts                   # Round-trip integrity tests
        └── repository-integration.spec.ts       # Repository integration tests
```

## 🔧 Configuration Examples

### Interface Definition

```typescript
interface IEventEncryptionFactory {
  encryptEvents<T>(events: T[], actor: ActorContext, config: EncryptionConfig): Promise<EncryptionResult<T>>;
  decryptEvents<T>(events: T[], actor: ActorContext, config: EncryptionConfig): Promise<DecryptionResult<T>>;

  // Static helpers
  static createSecretConfig(fields: string[], namespaceMap?: Record<string, string>): SecretEncryptionConfig;
  static createPIIConfig(options: {domain: string, tenant?: string}): PIIEncryptionConfig;
  static createHybridConfig(pipeline: EncryptionType[]): CompositeEncryptionConfig;
}

interface EncryptionStrategy {
  encrypt<T>(payload: T, context: EncryptionContext): Promise<EncryptedPayload<T>>;
  decrypt<T>(payload: T, context: EncryptionContext): Promise<DecryptedPayload<T>>;
  getMetadata(): EncryptionMetadata;
}

interface EncryptionMetadata {
  algorithm: string;
  keyId: string;
  tenant: string;
  namespace: string;
  timestamp: string;
  source: string;
  processedFields: string[];
  strategyVersion: string;
}
```

### SecretRef Encryption (SecureTest) - Using Static Helpers

```typescript
// Clean helper approach (recommended)
const config = EventEncryptionFactory.createSecretConfig(
  ['signingSecret', 'username', 'password'],
  { signingSecret: 'signing', username: 'auth', password: 'auth' },
);

// Traditional approach (still supported)
const config = {
  type: 'secret' as const,
  sensitiveFields: ['signingSecret', 'username', 'password'],
  namespaceMap: {
    signingSecret: 'signing',
    username: 'auth',
    password: 'auth',
  },
  defaultNamespace: 'general',
};
```

### PII Encryption (Webhook) - Using Static Helpers

```typescript
// Clean helper approach (recommended)
const config = EventEncryptionFactory.createPIIConfig({
  domain: 'webhook-config',
  tenant: actor.tenant,
});

// Traditional approach (still supported)
const config = {
  type: 'pii' as const,
  domain: 'webhook-config',
  tenant: actor.tenant,
  correlationId: 'optional-correlation-id',
};
```

### Hybrid Pipeline Encryption (Advanced)

```typescript
// Multiple strategies in sequence
const config = EventEncryptionFactory.createHybridConfig(['pii', 'kms']);

// Manual configuration
const config = {
  type: 'hybrid' as const,
  pipeline: ['pii', 'kms'] as const,
  strategies: {
    pii: { domain: 'webhook-config', tenant: actor.tenant },
    kms: { keyId: 'webhook-encryption-key', region: 'us-east-1' },
  },
};
```

### Environment Variable Encryption (Future)

```typescript
const config = {
  type: 'env' as const,
  envFields: ['DATABASE_URL', 'API_KEY', 'SECRET_TOKEN'],
  keyPrefix: 'config',
  keyManagement: 'doppler' | 'aws-kms' | 'azure-keyvault',
};
```

### No Encryption (Testing/Development)

```typescript
const config = {
  type: 'noop' as const,
};
```

## 🧪 Testing Strategy

### Unit Tests

- Factory creation and dependency injection
- Configuration validation for each encryption type
- Strategy selection and execution
- Error handling and edge cases
- Metadata generation

### Integration Tests

- End-to-end encryption/decryption cycles
- Repository integration with factory
- EventStore data validation
- Query/Reader repository decryption

### Performance Tests

- Encryption overhead measurement
- Memory usage profiling
- Throughput testing with large event batches

## 📊 Success Metrics

### Code Quality

- [ ] All repositories use consistent encryption pattern
- [ ] TypeScript strict mode compliance
- [ ] 100% test coverage for factory and strategies
- [ ] No eslint/prettier violations

### Functionality

- [ ] All existing encryption functionality preserved
- [ ] SecretRef encryption/decryption working end-to-end
- [ ] PII encryption working with compliance requirements
- [ ] No data corruption or security regressions

### Developer Experience

- [ ] Repository encryption code reduced by 80%+
- [ ] Single pattern for all encryption needs
- [ ] IntelliSense-guided configuration
- [ ] Clear error messages and validation

## 🚨 Risk Mitigation

### Data Security

- **Risk**: Encryption logic changes could compromise data security
- **Mitigation**: Comprehensive testing, gradual rollout, backup strategies

### Backward Compatibility

- **Risk**: Changes might break existing encrypted data
- **Mitigation**: Factory wraps existing services, no changes to encryption algorithms

### Performance Impact

- **Risk**: Additional abstraction might impact performance
- **Mitigation**: Benchmark existing vs factory performance, optimize if needed

### Integration Complexity

- **Risk**: DI and module registration complexity
- **Mitigation**: Start with simple injection, test thoroughly

## 📈 Future Enhancements

### Additional Encryption Types

- [ ] `'vault'` - HashiCorp Vault integration
- [ ] `'kms'` - AWS KMS or Azure Key Vault
- [x] ✅ `'hybrid'` - Multiple encryption strategies per event (pipeline execution)
- [ ] `'conditional'` - Runtime encryption decisions based on data classification
- [ ] `'field-level'` - Granular field-by-field encryption control
- [ ] `'temporal'` - Time-based encryption with automatic key rotation

### Advanced Features

- [ ] Encryption strategy composition
- [ ] Performance optimization and caching
- [ ] Audit trail for encryption operations
- [ ] Key rotation support

### Developer Tools

- [ ] CLI tool for testing encryption configurations
- [ ] Visual Studio Code extension for configuration
- [ ] Debug tooling for encryption troubleshooting

## 🎯 Implementation Priority

**High Priority (Must Have)**

1. 🔄 **NEW**: Bidirectional factory interface (`IEventEncryptionFactory`)
2. 🔄 **NEW**: Strategy pattern with consistent interfaces (`EncryptionStrategy`)
3. 🔄 **NEW**: Enriched metadata for observability (`EncryptionMetadata`)
4. 🔄 SecretRef and PII strategies with encrypt/decrypt symmetry
5. 🔄 Repository migration (Writer + Query/Reader repositories)
6. 🔄 **NEW**: Round-trip integrity testing and golden data tests

**Medium Priority (Should Have)** 7. 🔄 **NEW**: Static configuration helpers for developer ergonomics 8. 🔄 **NEW**: Hybrid pipeline strategy implementation 9. 🔄 Environment variable encryption strategy 10. 🔄 **NEW**: Dynamic module registration pattern 11. 🔄 Comprehensive documentation and migration guides

**Low Priority (Nice to Have)** 12. 🔄 **NEW**: Advanced pipeline features (conditional, field-level) 13. 🔄 Advanced developer tooling and CLI 14. 🔄 Performance optimizations and caching 15. 🔄 **NEW**: Key rotation and temporal encryption

## 📅 Timeline Estimate

- **Phase 1 (Foundation)**: 1-2 days
- **Phase 2 (Migration)**: 2-3 days
- **Phase 3 (Testing)**: 1-2 days
- **Phase 4 (Extensions)**: 1-2 days

**Total Estimated Time**: 5-9 days

**Recommended Approach**: Start with Phase 1-2 for immediate benefits, then iterate on Phase 3-4 based on feedback and requirements.

## ⚙️ Key Improvements From Recommendations

### A. Bidirectional Factory Interface

- **Problem**: Original plan only handled encryption (writer repositories)
- **Solution**: `IEventEncryptionFactory` with symmetric `encryptEvents()` and `decryptEvents()`
- **Benefit**: Query/Reader repositories use same configuration for decryption

### B. Strategy Contract Consistency

- **Problem**: Each encryption handler had different interfaces
- **Solution**: `EncryptionStrategy` interface ensures consistent `encrypt()` and `decrypt()` methods
- **Benefit**: Pluggable strategies with guaranteed API shape

### C. Enriched Metadata

- **Problem**: Limited observability and auditability
- **Solution**: Standardized `EncryptionMetadata` with algorithm, keyId, tenant, namespace, etc.
- **Benefit**: Rich observability without altering domain event structure

### D. Enhanced Testing

- **Problem**: Basic functional testing only
- **Solution**: Golden data tests, round-trip integrity checks, mock key management
- **Benefit**: Ensures encrypted payloads remain decryptable after algorithm updates

### E. Developer Ergonomics

- **Problem**: Configuration boilerplate and human error prone
- **Solution**: Static helpers like `createPIIConfig()` and `createSecretConfig()`
- **Benefit**: Consistent configuration patterns and reduced errors

### F. Pipeline Architecture

- **Problem**: Single encryption per event limitation
- **Solution**: Hybrid strategy with pipeline execution (e.g., `pii + kms`)
- **Benefit**: Layered security and flexible encryption composition

### G. Module Simplification

- **Problem**: Risk of circular dependencies with new modules
- **Solution**: Dynamic module pattern within existing `SecretRefModule`
- **Benefit**: Clean dependency injection without architectural complexity

**🚨 Breaking Change Note**: This is explicitly NOT backward compatible to ensure clean architecture and avoid legacy technical debt.
