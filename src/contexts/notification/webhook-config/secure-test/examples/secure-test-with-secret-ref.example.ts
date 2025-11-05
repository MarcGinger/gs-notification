/**
 * Example: SecureTest Aggregate with SecretRef Protection
 *
 * This example shows how to work with the SecretRef-protected SecureTestProps
 * in domain aggregates and application services.
 */

import { Injectable } from '@nestjs/common';
import { SecureTestProps } from '../domain/props/secure-test.props';
import { SecureTestSecretService } from '../domain/services/secure-test-secret.service';

/**
 * SecureTest Domain Aggregate
 *
 * Notice how the aggregate works with SecretRef instances instead of plaintext.
 * The actual secret resolution is delegated to infrastructure services.
 */
export class SecureTestAggregate {
  constructor(private readonly props: SecureTestProps) {}

  // ✅ SAFE: Domain logic works with references, not values
  hasSigningCapability(): boolean {
    return !!this.props.signingSecretRef && !!this.props.signatureAlgorithm;
  }

  hasAuthenticationCapability(): boolean {
    return !!this.props.usernameRef && !!this.props.passwordRef;
  }

  getSecretMetadata() {
    return {
      hasSigningSecret: !!this.props.signingSecretRef,
      hasUsername: !!this.props.usernameRef,
      hasPassword: !!this.props.passwordRef,
      signingSecretProvider: this.props.signingSecretRef?.ref.provider,
      authProvider: this.props.usernameRef?.ref.provider,
    };
  }

  // ✅ SAFE: Events contain references, not plaintext
  toEvent() {
    return {
      id: this.props.id,
      name: this.props.name,
      type: this.props.type,
      hasSecrets:
        this.hasSigningCapability() || this.hasAuthenticationCapability(),
      // SecretRef instances are safe to serialize
      signingSecretRef: this.props.signingSecretRef,
      usernameRef: this.props.usernameRef,
      passwordRef: this.props.passwordRef,
    };
  }
}

/**
 * Application Service Example
 *
 * Shows how to use SecretRef-protected domain objects in application services
 * that need to perform actual operations with the resolved secrets.
 */
@Injectable()
export class SecureTestApplicationService {
  constructor(private readonly secretService: SecureTestSecretService) {}

  /**
   * Execute webhook with signature - Infrastructure operation that needs actual secrets
   */
  async executeSignedWebhook(
    secureTest: SecureTestAggregate,
    payload: any,
    tenantId: string,
  ) {
    if (!secureTest.hasSigningCapability()) {
      throw new Error('SecureTest does not have signing capability');
    }

    // ✅ SECURE: Secret resolution happens at the infrastructure boundary
    const signingSecret = await this.secretService.resolveSigningSecret(
      secureTest['props'], // Access private props for infrastructure
      tenantId,
    );

    if (!signingSecret) {
      throw new Error('Failed to resolve signing secret');
    }

    // Use the resolved secret for actual infrastructure operation
    const signature = this.computeSignature(payload, signingSecret);

    return this.sendWebhookWithSignature(payload, signature);
  }

  /**
   * Execute authenticated request - Another infrastructure operation
   */
  async executeAuthenticatedRequest(
    secureTest: SecureTestAggregate,
    request: any,
    tenantId: string,
  ) {
    if (!secureTest.hasAuthenticationCapability()) {
      throw new Error('SecureTest does not have authentication capability');
    }

    const credentials = await this.secretService.resolveAuthCredentials(
      secureTest['props'],
      tenantId,
    );

    if (!credentials.username || !credentials.password) {
      throw new Error('Failed to resolve authentication credentials');
    }

    return this.sendAuthenticatedRequest(request, {
      username: credentials.username,
      password: credentials.password,
    });
  }

  private computeSignature(payload: any, secret: string): string {
    // Implementation would use actual crypto
    return `signature_${JSON.stringify(payload).length}_${secret.length}`;
  }

  private async sendWebhookWithSignature(payload: any, signature: string) {
    // Implementation would make actual HTTP request
    return { payload, signature, status: 'sent' };
  }

  private async sendAuthenticatedRequest(
    request: any,
    credentials: { username: string; password: string },
  ) {
    // Implementation would make actual authenticated HTTP request
    return { request, auth: 'basic', status: 'sent' };
  }
}

/**
 * Factory for creating SecureTest instances with proper SecretRef setup
 */
export class SecureTestFactory {
  static createWithSecrets(
    id: string,
    name: string,
    type: any,
    secretConfig: {
      tenant: string;
      namespace: string;
      signingKey?: string;
      usernameKey?: string;
      passwordKey?: string;
    },
  ): SecureTestAggregate {
    const secretService = new SecureTestSecretService(null as any); // DI would provide this

    const props = secretService.createSecureTestWithSecrets(
      { id, name, type },
      secretConfig,
    );

    return new SecureTestAggregate(props);
  }
}
