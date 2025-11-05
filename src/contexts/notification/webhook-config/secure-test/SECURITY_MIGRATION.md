# SecureTest SecretRef Migration Guide

## 🔒 **Security Improvement Summary**

The `SecureTestProps` interface has been enhanced to use **SecretRef** instead of plaintext strings for sensitive fields:

### **Before (Vulnerable):**

```typescript
export interface SecureTestProps {
  id: string;
  name: string;
  signingSecret?: string; // ❌ PLAINTEXT - Vulnerable to logging
  username?: string; // ❌ PLAINTEXT - Could appear in events
  password?: string; // ❌ PLAINTEXT - No rotation capability
}
```

### **After (Secure):**

```typescript
export interface SecureTestProps {
  id: string;
  name: string;
  signingSecretRef?: SecureTestSecretRef; // ✅ SECURE - Reference only
  usernameRef?: SecureTestSecretRef; // ✅ SECURE - Tenant isolated
  passwordRef?: SecureTestSecretRef; // ✅ SECURE - Rotation ready
}
```

## 🛡️ **Security Benefits Achieved**

1. **Zero Plaintext Exposure** - No secret values in domain events, snapshots, or logs
2. **Tenant Isolation** - Secrets are scoped by tenant/namespace with policy enforcement
3. **Rotation Support** - Secrets can be rotated without code changes
4. **Audit Trail** - All secret access is logged without exposing values
5. **Access Control** - Rate limiting and environment-based restrictions

## 📁 **Files Modified/Created**

### **Modified:**

- `secure-test.props.ts` - Updated props interface with SecretRef fields
- `value-objects/index.ts` - Added new SecretRef value object export

### **Created:**

- `value-objects/secure-test-secret-ref.vo.ts` - Domain-specific SecretRef factory
- `services/secure-test-secret.service.ts` - Secret resolution service
- `examples/secure-test-with-secret-ref.example.ts` - Usage examples

## 🔄 **Migration Strategy**

### **Phase 1: Dual Support (Current)**

```typescript
// Both interfaces available during migration
export interface SecureTestProps {
  // ✅ New secure version
  signingSecretRef?: SecureTestSecretRef;
  usernameRef?: SecureTestSecretRef;
  passwordRef?: SecureTestSecretRef;
}

export interface SecureTestPropsLegacy {
  // 🔄 Temporary legacy support
  signingSecret?: string;
  username?: string;
  password?: string;
}
```

### **Phase 2: Secret Storage Setup**

Configure secrets in Doppler following the path convention:

```
# Signing secrets
{tenant}/{namespace}/signing/{secret-key}

# Authentication secrets
{tenant}/{namespace}/auth/username/{secret-key}
{tenant}/{namespace}/auth/password/{secret-key}

# Example paths:
core/notification/signing/webhook-test-1
core/notification/auth/username/service-account-1
core/notification/auth/password/service-account-1
```

### **Phase 3: Code Migration**

Use the migration service to convert existing data:

```typescript
const legacyProps = {
  id: 'test-1',
  signingSecret: 'secret123',
  username: 'user',
  password: 'pass',
};

// Migrate to SecretRef-protected version
const secureProps = await secretService.migrateLegacyProps(
  legacyProps,
  'core', // tenant
  'notification', // namespace
);
```

## 🎯 **Usage Examples**

### **Creating SecureTest with Secrets:**

```typescript
import { SecureTestSecretRefFactory } from './domain/value-objects';

// Create SecretRef for signing
const signingSecretRef = SecureTestSecretRefFactory.createSigningSecretRef(
  'core', // tenant
  'notification', // namespace
  'webhook-test-1', // secret key in Doppler
  'latest', // version
);

const props: SecureTestProps = {
  id: 'test-1',
  name: 'Webhook Test',
  signingSecretRef,
  signatureAlgorithm: 'HMAC-SHA256',
};
```

### **Resolving Secrets for Infrastructure Operations:**

```typescript
@Injectable()
export class WebhookService {
  constructor(private secretService: SecureTestSecretService) {}

  async signWebhook(
    secureTest: SecureTestProps,
    payload: any,
    tenantId: string,
  ) {
    // ✅ SECURE: Secret resolved only when needed
    const signingSecret = await this.secretService.resolveSigningSecret(
      secureTest,
      tenantId,
    );

    // Use secret for signing (never log it!)
    const signature = computeHmacSha256(payload, signingSecret);
    return signature;
  }
}
```

### **Domain Events (Safe):**

```typescript
// ✅ SAFE: Events contain references, not plaintext
const event = {
  type: 'SecureTestConfigured',
  id: props.id,
  hasSigningCapability: !!props.signingSecretRef,
  signingSecretRef: props.signingSecretRef, // Safe to serialize
  timestamp: new Date(),
};
```

## ⚙️ **Environment Setup**

Add Doppler configuration:

```bash
# Required environment variables
DOPPLER_TOKEN=dp.st.your-service-token
DOPPLER_PROJECT=gs-notification
DOPPLER_CONFIG=dev

# Optional configuration
DOPPLER_BASE_URL=https://api.doppler.com
DOPPLER_TIMEOUT_MS=5000
```

## 🧪 **Testing Strategy**

### **Unit Tests:**

```typescript
describe('SecureTestProps', () => {
  it('should not expose plaintext secrets in serialization', () => {
    const props = createSecureTestWithSecrets();
    const serialized = JSON.stringify(props);

    // ✅ Assert no plaintext secrets in serialized output
    expect(serialized).not.toContain('actual-secret-value');
    expect(serialized).toContain('signingSecretRef');
  });
});
```

### **Integration Tests:**

```typescript
describe('SecureTestSecretService', () => {
  it('should resolve secrets with proper tenant isolation', async () => {
    const secret = await service.resolveSigningSecret(props, 'tenant-1');
    expect(secret).toBeDefined();

    // Should fail for different tenant
    await expect(
      service.resolveSigningSecret(props, 'tenant-2'),
    ).rejects.toThrow('tenant mismatch');
  });
});
```

## 🚨 **Important Security Notes**

1. **Never Log Resolved Secrets** - Only log SecretRef metadata
2. **Use Tenant Context** - Always provide proper tenant ID for resolution
3. **Cache Appropriately** - Secrets are cached with TTL for performance
4. **Monitor Access** - All secret access is logged and metered
5. **Rotate Regularly** - Use pinned versions in production, rotate by updating refs

## 📈 **Performance Considerations**

- **Caching**: Secrets are cached in memory with configurable TTL
- **Deduplication**: Concurrent requests for same secret are deduplicated
- **Circuit Breaker**: Provider failures don't cascade to application failures
- **Background Resolution**: Use `hydrate()` to pre-warm caches

## 🔄 **Rollback Plan**

If issues arise, the legacy interface remains available:

```typescript
// Fallback to legacy props during issues
const legacyProps: SecureTestPropsLegacy = {
  id: props.id,
  name: props.name,
  signingSecret: process.env.FALLBACK_SIGNING_SECRET,
  username: process.env.FALLBACK_USERNAME,
  password: process.env.FALLBACK_PASSWORD,
};
```

## ✅ **Security Checklist**

- [ ] All sensitive fields use SecretRef instead of plaintext
- [ ] Secrets are stored in Doppler with proper naming convention
- [ ] Tenant isolation is configured and tested
- [ ] No plaintext secrets appear in logs, events, or snapshots
- [ ] Secret resolution is cached appropriately
- [ ] Rate limits are configured for secret access
- [ ] Health checks verify secret provider connectivity
- [ ] Migration path is tested and documented

---

**🎉 SecureTest is now protected by SecretRef! Your secrets are safe from accidental exposure while maintaining full functionality.** 🔐
