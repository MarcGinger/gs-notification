# 🚀 Sealed SecretRef Implementation Plan

## Executive Summary

This document provides a phased implementation plan for migrating from global shared Doppler keys to tenant-scoped envelope encryption using the Sealed SecretRef design. The implementation will maintain backward compatibility while addressing the critical security vulnerability of shared secrets.

---

## Phase 1: Foundation & Core Cryptography (Week 1)

### 1.1 Enhanced Type System

**Files to Create/Modify:**

- `src/shared/infrastructure/secret-ref/domain/sealed-secret-ref.types.ts`
- `src/shared/infrastructure/secret-ref/domain/secret-ref.types.ts` (enhance existing)

**Implementation Steps:**

1. Create `SealedSecretRef` interface extending base `SecretRef`
2. Update `SecretRefUnion` type to include sealed variants
3. Add type guards for runtime type checking
4. Update existing imports to use new union types

**Acceptance Criteria:**

- [ ] TypeScript compilation successful with new types
- [ ] Existing code continues to work with enhanced types
- [ ] Type guards correctly identify sealed vs doppler refs

### 1.2 Sealed Secret Service Implementation

**Files to Create:**

- `src/shared/infrastructure/secret-ref/infrastructure/sealed-secret.service.ts`
- `src/shared/infrastructure/secret-ref/infrastructure/crypto/` (new directory)
  - `envelope-encryption.util.ts`
  - `key-derivation.util.ts`
  - `crypto.constants.ts`

**Implementation Steps:**

1. Create crypto utilities for XChaCha20-Poly1305 and AES-256-GCM
2. Implement envelope encryption/decryption functions
3. Build `SealedSecretService` with seal/unseal methods
4. Add comprehensive error handling and logging
5. Create unit tests for cryptographic functions

**Acceptance Criteria:**

- [ ] Seal/unseal operations work with test vectors
- [ ] Error handling for malformed envelopes
- [ ] Cryptographic operations are constant-time where possible
- [ ] Unit tests achieve >95% coverage
- [ ] No plaintext secrets logged in any scenario

### 1.3 Enhanced SecretRefService Integration

**Files to Modify:**

- `src/shared/infrastructure/secret-ref/application/secret-ref.service.ts`
- `src/shared/infrastructure/secret-ref/secret-ref.module.ts`

**Implementation Steps:**

1. Add `SealedSecretService` as dependency
2. Implement provider switching logic in `resolveSecret()`
3. Add `createSealedRef()` method for sealing new secrets
4. Update module to register sealed service
5. Maintain backward compatibility with doppler provider

**Acceptance Criteria:**

- [ ] Both doppler and sealed providers work simultaneously
- [ ] No breaking changes to existing `resolveSecret()` API
- [ ] New `createSealedRef()` method available
- [ ] Module properly injects all dependencies

---

## Phase 2: Tenant Key Management (Week 2)

### 2.1 Doppler KEK Setup Script

**Files to Create:**

- `scripts/setup-tenant-keks.js`
- `scripts/rotate-tenant-keks.js`
- `docs/TENANT_KEY_MANAGEMENT.md`

**Implementation Steps:**

1. Create script to generate and store tenant KEKs in Doppler
2. Implement key rotation workflow
3. Add validation for KEK presence and format
4. Create operational documentation
5. Test with development Doppler project

**Acceptance Criteria:**

- [ ] Script generates cryptographically secure KEKs
- [ ] KEKs stored in Doppler with correct naming convention
- [ ] Rotation script creates new version while preserving old
- [ ] Documentation covers key lifecycle management
- [ ] Development environment has working KEKs

### 2.2 Tenant Resolution Strategy

**Files to Create/Modify:**

- `src/shared/infrastructure/secret-ref/domain/tenant-resolver.interface.ts`
- `src/shared/infrastructure/secret-ref/infrastructure/tenant-resolver.service.ts`
- `src/contexts/notification/webhook-config/secure-test/domain/secure-test.entity.ts` (modify)

**Implementation Steps:**

1. Define tenant resolution interface
2. Implement tenant resolver service (default: 'core' tenant)
3. Add tenant context to SecureTest aggregate
4. Update domain events to include tenant information
5. Ensure tenant propagation through event/command flow

**Acceptance Criteria:**

- [ ] Tenant resolver correctly identifies tenant from context
- [ ] SecureTest entities include tenant metadata
- [ ] Domain events carry tenant information
- [ ] No hardcoded tenant assumptions in business logic

---

## Phase 3: Repository Integration (Week 3)

### 3.1 Enhanced Field Validator

**Files to Modify:**

- `src/contexts/notification/webhook-config/secure-test/infrastructure/utilities/secure-test-field-validator.util.ts`

**Implementation Steps:**

1. Add `createSealedSecretRef()` method for generating sealed refs
2. Modify `createSecureTestProjectorDataFromEventData()` to support sealed refs
3. Add tenant context extraction from event data
4. Implement mixed-mode support (doppler + sealed)
5. Add validation for sealed ref structure

**Acceptance Criteria:**

- [ ] Can create both doppler and sealed SecretRefs
- [ ] Tenant information correctly extracted from events
- [ ] Backward compatibility maintained for existing data
- [ ] Validation prevents malformed sealed refs
- [ ] Field validator tests updated and passing

### 3.2 Repository Updates

**Files to Modify:**

- `src/contexts/notification/webhook-config/secure-test/infrastructure/repositories/secure-test-redis-reader.repository.ts`
- `src/contexts/notification/webhook-config/secure-test/infrastructure/repositories/secure-test-redis-query.repository.ts`

**Implementation Steps:**

1. Update repositories to handle sealed SecretRefs
2. Modify `parseRedisHashToSecureTest()` to unseal secrets
3. Add error handling for unsealing failures
4. Update `resolveSecretRefFromRedis()` to support sealed provider
5. Add performance monitoring for unseal operations

**Acceptance Criteria:**

- [ ] Repositories can read both doppler and sealed refs
- [ ] Unsealing errors are handled gracefully
- [ ] Performance impact within acceptable bounds
- [ ] Monitoring/logging for operational visibility
- [ ] Repository tests cover mixed-mode scenarios

### 3.3 Projector Updates

**Files to Modify:**

- `src/contexts/notification/webhook-config/secure-test/infrastructure/projectors/secure-test-redis.projector.ts`

**Implementation Steps:**

1. Update projector to use enhanced field validator
2. Add tenant resolution during projection
3. Implement sealed ref creation for new events
4. Maintain doppler support for backward compatibility
5. Add monitoring for projection operations

**Acceptance Criteria:**

- [ ] New events projected with sealed refs
- [ ] Existing events continue to work
- [ ] Tenant context preserved through projection
- [ ] Projection performance maintained
- [ ] Error handling for seal failures

---

## Phase 4: API Layer Integration (Week 4)

### 4.1 Controller Enhancements

**Files to Modify:**

- `src/contexts/notification/webhook-config/secure-test/interfaces/http/secure-test.controller.ts`

**Implementation Steps:**

1. Add tenant context to create/update operations
2. Implement sealed ref creation for new webhook configs
3. Add migration endpoint for converting doppler to sealed refs
4. Update response models to handle mixed provider types
5. Add validation for tenant authorization

**Acceptance Criteria:**

- [ ] New webhook configs use sealed refs by default
- [ ] Migration endpoint converts existing configs safely
- [ ] API responses don't leak provider implementation details
- [ ] Tenant isolation enforced at API layer
- [ ] API tests cover sealed ref scenarios

### 4.2 End-to-End Testing

**Files to Create:**

- `test/sealed-secretref-e2e.spec.ts`
- `scripts/test-sealed-workflow.js`

**Implementation Steps:**

1. Create comprehensive E2E tests for sealed ref workflow
2. Test create → store → retrieve → decrypt flow
3. Verify tenant isolation
4. Test rotation scenarios
5. Performance benchmarking

**Acceptance Criteria:**

- [ ] Full E2E workflow tests pass
- [ ] Tenant isolation verified
- [ ] Performance within acceptable bounds
- [ ] Rotation scenarios work correctly
- [ ] Test coverage >90% for sealed ref code paths

---

## Phase 5: Migration & Production Readiness (Week 5)

### 5.1 Data Migration Strategy

**Files to Create:**

- `scripts/migrate-to-sealed-refs.js`
- `scripts/verify-migration.js`
- `docs/MIGRATION_RUNBOOK.md`

**Implementation Steps:**

1. Create migration script for existing webhook configs
2. Implement rollback mechanism
3. Add verification script for migration completeness
4. Create operational runbook
5. Test migration in staging environment

**Acceptance Criteria:**

- [ ] Migration script handles all existing configs
- [ ] Rollback mechanism verified working
- [ ] Zero-downtime migration possible
- [ ] Staging migration successful
- [ ] Operational documentation complete

### 5.2 Monitoring & Observability

**Files to Create/Modify:**

- `src/shared/infrastructure/secret-ref/infrastructure/sealed-secret.metrics.ts`
- `src/shared/infrastructure/secret-ref/application/secret-ref.service.ts` (add metrics)

**Implementation Steps:**

1. Add metrics for seal/unseal operations
2. Implement health checks for KEK availability
3. Add alerting for unsealing failures
4. Create dashboard for secret operations
5. Add audit logging for secret access

**Acceptance Criteria:**

- [ ] Metrics collected for all secret operations
- [ ] Health checks detect KEK availability issues
- [ ] Alerts configured for failure scenarios
- [ ] Dashboard provides operational visibility
- [ ] Audit logs meet compliance requirements

### 5.3 Security Validation

**Files to Create:**

- `security/sealed-secretref-security-test.js`
- `docs/SECURITY_ANALYSIS.md`

**Implementation Steps:**

1. Conduct security review of implementation
2. Test crypto-erasure scenarios
3. Verify tenant isolation
4. Test key rotation procedures
5. Document security characteristics

**Acceptance Criteria:**

- [ ] Security review completed with no high-risk findings
- [ ] Crypto-erasure verified working
- [ ] Tenant isolation tested and confirmed
- [ ] Key rotation procedures validated
- [ ] Security documentation complete

---

## Production Rollout Strategy

### Phase A: Canary Deployment (10% traffic)

- Deploy sealed ref capability to production
- Configure 10% of new webhook configs to use sealed refs
- Monitor metrics and error rates
- Validate tenant KEKs working in production

### Phase B: Gradual Rollout (50% traffic)

- Increase sealed ref usage to 50% of new configs
- Begin migration of existing doppler configs in batches
- Monitor performance impact
- Validate rotation procedures

### Phase C: Full Deployment (100% traffic)

- All new configs use sealed refs
- Complete migration of existing configs
- Begin deprecation timeline for doppler provider
- Monitor for any remaining issues

### Phase D: Legacy Cleanup

- Remove doppler provider support
- Clean up global shared keys from Doppler
- Update documentation to reflect sealed-only approach
- Archive migration scripts

---

## Success Metrics

### Security Metrics

- [ ] Zero cross-tenant secret access incidents
- [ ] Successful crypto-erasure within 24 hours of key deletion
- [ ] 100% of webhook configs using tenant-scoped encryption

### Performance Metrics

- [ ] Seal/unseal operations <10ms p95
- [ ] No impact on API response times
- [ ] Migration completes within maintenance window

### Operational Metrics

- [ ] Zero failed key rotations
- [ ] 99.9% KEK availability
- [ ] All alerts functioning correctly

---

## Risk Mitigation

### High-Risk Items

1. **Crypto Implementation Bug**: Comprehensive testing, security review, and gradual rollout
2. **Key Loss/Corruption**: Multiple KEK backups, key rotation testing, and recovery procedures
3. **Performance Impact**: Benchmarking, gradual rollout, and rollback capability
4. **Migration Failure**: Staged migration, verification scripts, and rollback procedures

### Rollback Plan

1. **Phase 1-3**: Code rollback sufficient
2. **Phase 4**: API rollback + data consistency check
3. **Phase 5**: Full rollback with data migration reversal

---

## Dependencies & Prerequisites

### External Dependencies

- [ ] Doppler project with write access for KEK management
- [ ] Node.js crypto module supports required algorithms
- [ ] Redis/EventStore performance acceptable for encrypted data

### Internal Dependencies

- [ ] Existing SecretRef infrastructure operational
- [ ] Test environment with Doppler integration
- [ ] Monitoring infrastructure available

### Skills Required

- Cryptography implementation experience
- NestJS/TypeScript expertise
- Redis and EventStore knowledge
- DevOps and deployment experience

---

## Estimated Timeline: 5 weeks

**Total Effort**: ~120-150 hours
**Team Size**: 2-3 developers recommended
**Critical Path**: Crypto implementation → Repository integration → Migration
