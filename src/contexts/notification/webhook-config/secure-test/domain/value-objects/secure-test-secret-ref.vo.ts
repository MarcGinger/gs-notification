// SecretRef Value Objects for Secure Test Domain
import { SecretRef } from 'src/shared/infrastructure/secret-ref';

/**
 * SecretRef Value Object for domain use
 * Wraps SecretRef with domain-specific validation and behavior
 */
export interface SecureTestSecretRef {
  readonly ref: SecretRef;
  readonly purpose: 'signing' | 'auth' | 'webhook';
}

/**
 * Factory functions for creating domain-specific SecretRefs
 */
export class SecureTestSecretRefFactory {
  static createSigningSecretRef(
    tenant: string,
    namespace: string,
    secretKey: string,
    version?: string,
  ): SecureTestSecretRef {
    return {
      ref: {
        scheme: 'secret',
        provider: 'doppler',
        tenant,
        namespace,
        key: `signing/${secretKey}`,
        version,
      },
      purpose: 'signing',
    };
  }

  static createAuthSecretRef(
    tenant: string,
    namespace: string,
    credentialType: 'username' | 'password',
    secretKey: string,
    version?: string,
  ): SecureTestSecretRef {
    return {
      ref: {
        scheme: 'secret',
        provider: 'doppler',
        tenant,
        namespace,
        key: `auth/${credentialType}/${secretKey}`,
        version,
      },
      purpose: 'auth',
    };
  }

  static createWebhookSecretRef(
    tenant: string,
    namespace: string,
    secretKey: string,
    version?: string,
  ): SecureTestSecretRef {
    return {
      ref: {
        scheme: 'secret',
        provider: 'doppler',
        tenant,
        namespace,
        key: `webhook/${secretKey}`,
        version,
      },
      purpose: 'webhook',
    };
  }
}
