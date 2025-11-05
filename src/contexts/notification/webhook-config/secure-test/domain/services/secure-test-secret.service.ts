import { Injectable } from '@nestjs/common';
import { SecretRefService } from 'src/shared/infrastructure/secret-ref';
import { AppConfigUtil } from 'src/shared/config/app-config.util';
import { SecureTestProps } from '../props/secure-test.props';
import { SecureTestSecretRefFactory } from '../value-objects/secure-test-secret-ref.vo';

/**
 * SecureTestSecretService
 *
 * Demonstrates how to safely work with SecretRef-protected SecureTest domain objects.
 * This service handles the resolution of secret references to actual values when needed
 * for infrastructure operations (HTTP signing, authentication, etc.).
 */
@Injectable()
export class SecureTestSecretService {
  constructor(private readonly secretRef: SecretRefService) {}

  /**
   * Resolve signing secret for webhook signature verification
   */
  async resolveSigningSecret(
    props: SecureTestProps,
    tenantId: string,
  ): Promise<string | null> {
    if (!props.signingSecretRef) return null;

    const ctx = {
      tenantId,
      boundedContext: 'notification',
      purpose: 'http-sign' as const,
      environment: AppConfigUtil.getEnvironment(),
    };

    const { value } = await this.secretRef.resolve(
      props.signingSecretRef.ref,
      { minTtlMs: 60_000 }, // Cache for at least 1 minute
      ctx,
    );

    return value;
  }

  /**
   * Resolve authentication credentials for webhook calls
   */
  async resolveAuthCredentials(
    props: SecureTestProps,
    tenantId: string,
  ): Promise<{ username?: string; password?: string }> {
    const ctx = {
      tenantId,
      boundedContext: 'notification',
      purpose: 'http-sign' as const,
      environment: AppConfigUtil.getEnvironment(),
    };

    const results = await Promise.allSettled([
      props.usernameRef
        ? this.secretRef.resolve(
            props.usernameRef.ref,
            { minTtlMs: 60_000 },
            ctx,
          )
        : Promise.resolve(null),
      props.passwordRef
        ? this.secretRef.resolve(
            props.passwordRef.ref,
            { minTtlMs: 60_000 },
            ctx,
          )
        : Promise.resolve(null),
    ]);

    return {
      username:
        results[0].status === 'fulfilled' && results[0].value
          ? results[0].value.value
          : undefined,
      password:
        results[1].status === 'fulfilled' && results[1].value
          ? results[1].value.value
          : undefined,
    };
  }

  /**
   * Create SecureTestProps with SecretRef protection
   * Helper method for creating domain objects with proper secret references
   */
  createSecureTestWithSecrets(
    baseProps: {
      id: string;
      name: string;
      description?: string;
      type: any;
      signatureAlgorithm?: any;
    },
    secretConfig: {
      tenant: string;
      namespace: string;
      signingSecretKey?: string;
      usernameKey?: string;
      passwordKey?: string;
      version?: string;
    },
  ): SecureTestProps {
    return {
      ...baseProps,
      signingSecretRef: secretConfig.signingSecretKey
        ? SecureTestSecretRefFactory.createSigningSecretRef(
            secretConfig.tenant,
            secretConfig.namespace,
            secretConfig.signingSecretKey,
            secretConfig.version,
          )
        : undefined,
      usernameRef: secretConfig.usernameKey
        ? SecureTestSecretRefFactory.createAuthSecretRef(
            secretConfig.tenant,
            secretConfig.namespace,
            'username',
            secretConfig.usernameKey,
            secretConfig.version,
          )
        : undefined,
      passwordRef: secretConfig.passwordKey
        ? SecureTestSecretRefFactory.createAuthSecretRef(
            secretConfig.tenant,
            secretConfig.namespace,
            'password',
            secretConfig.passwordKey,
            secretConfig.version,
          )
        : undefined,
    };
  }

  /**
   * Migration helper: Convert legacy props to SecretRef-protected props
   * @deprecated Use only during migration period
   */
  async migrateLegacyProps(
    legacyProps: {
      id: string;
      name: string;
      description?: string;
      type: any;
      signingSecret?: string;
      signatureAlgorithm?: any;
      username?: string;
      password?: string;
    },
    tenant: string,
    namespace: string,
  ): Promise<SecureTestProps> {
    // This would typically involve:
    // 1. Storing the plaintext values in Doppler
    // 2. Creating SecretRef instances
    // 3. Returning the protected props

    // For demo purposes, creating refs that would need actual secrets in Doppler
    return {
      id: legacyProps.id,
      name: legacyProps.name,
      description: legacyProps.description,
      type: legacyProps.type,
      signatureAlgorithm: legacyProps.signatureAlgorithm,
      signingSecretRef: legacyProps.signingSecret
        ? SecureTestSecretRefFactory.createSigningSecretRef(
            tenant,
            namespace,
            `${legacyProps.id}-signing`,
            'latest',
          )
        : undefined,
      usernameRef: legacyProps.username
        ? SecureTestSecretRefFactory.createAuthSecretRef(
            tenant,
            namespace,
            'username',
            `${legacyProps.id}-username`,
            'latest',
          )
        : undefined,
      passwordRef: legacyProps.password
        ? SecureTestSecretRefFactory.createAuthSecretRef(
            tenant,
            namespace,
            'password',
            `${legacyProps.id}-password`,
            'latest',
          )
        : undefined,
    };
  }
}
