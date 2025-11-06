// SecretRef Value Objects for Secure Test Domain
import { SecretRef } from 'src/shared/infrastructure/secret-ref';

/**
 * SecretRef Value Object for domain use
 * Wraps SecretRef with domain-specific validation and behavior
 */
export interface SecureTestSecretRef {
  readonly ref: SecretRef;
  readonly purpose: 'signing' | 'auth' | 'webhook';
  equals(other: SecureTestSecretRef): boolean;
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
    const ref = {
      scheme: 'secret' as const,
      provider: 'doppler' as const,
      tenant,
      namespace,
      key: `signing/${secretKey}`,
      version,
    };
    const purpose = 'signing' as const;

    return {
      ref,
      purpose,
      equals(other: SecureTestSecretRef): boolean {
        return (
          ref.tenant === other.ref.tenant &&
          ref.namespace === other.ref.namespace &&
          ref.key === other.ref.key &&
          ref.version === other.ref.version &&
          purpose === other.purpose
        );
      },
    };
  }

  static createAuthSecretRef(
    tenant: string,
    namespace: string,
    credentialType: 'username' | 'password',
    secretKey: string,
    version?: string,
  ): SecureTestSecretRef {
    const ref = {
      scheme: 'secret' as const,
      provider: 'doppler' as const,
      tenant,
      namespace,
      key: `auth/${credentialType}/${secretKey}`,
      version,
    };
    const purpose = 'auth' as const;

    return {
      ref,
      purpose,
      equals(other: SecureTestSecretRef): boolean {
        return (
          ref.tenant === other.ref.tenant &&
          ref.namespace === other.ref.namespace &&
          ref.key === other.ref.key &&
          ref.version === other.ref.version &&
          purpose === other.purpose
        );
      },
    };
  }

  static createWebhookSecretRef(
    tenant: string,
    namespace: string,
    secretKey: string,
    version?: string,
  ): SecureTestSecretRef {
    const ref = {
      scheme: 'secret' as const,
      provider: 'doppler' as const,
      tenant,
      namespace,
      key: `webhook/${secretKey}`,
      version,
    };
    const purpose = 'webhook' as const;

    return {
      ref,
      purpose,
      equals(other: SecureTestSecretRef): boolean {
        return (
          ref.tenant === other.ref.tenant &&
          ref.namespace === other.ref.namespace &&
          ref.key === other.ref.key &&
          ref.version === other.ref.version &&
          purpose === other.purpose
        );
      },
    };
  }
}
