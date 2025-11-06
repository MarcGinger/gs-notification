/**
 * Simple SecretRef Service for SecureTest
 *
 * Clean, straightforward service for creating SecretRef instances
 * in the SecureTest domain. No migration complexity needed.
 */

import { Injectable } from '@nestjs/common';
import { Result, err, ok, DomainError } from 'src/shared/errors';
import type { ActorContext } from 'src/shared/application/context/actor-context';

import { CreateSecureTestProps, SecureTestProps } from '../../domain/props';
import {
  SecureTestSecretRefFactory,
  SecureTestSecretRef,
} from '../../domain/value-objects';

/**
 * SecureTestSecretRefService
 *
 * Simple service to convert CreateSecureTestProps (with plaintext secrets)
 * to SecureTestProps (with SecretRef protection).
 */
@Injectable()
export class SecureTestSecretRefService {
  /**
   * Create SecureTest with SecretRef protection
   *
   * Converts plaintext secrets to SecretRef instances for secure storage.
   */
  createSecureTest(
    request: CreateSecureTestProps,
    context: ActorContext,
  ): Result<SecureTestProps, DomainError> {
    try {
      // Base properties (no secrets)
      const baseProps: Omit<
        SecureTestProps,
        'signingSecretRef' | 'usernameRef' | 'passwordRef'
      > = {
        id: request.id,
        name: request.name,
        description: request.description,
        type: request.type,
        signatureAlgorithm: request.signatureAlgorithm,
      };

      // Create SecretRef instances for sensitive fields if they exist
      const secureProps: SecureTestProps = {
        ...baseProps,
        signingSecretRef: request.signingSecret
          ? this.createSigningSecretRef(request, context)
          : undefined,
        usernameRef: request.username
          ? this.createUsernameSecretRef(request, context)
          : undefined,
        passwordRef: request.password
          ? this.createPasswordSecretRef(request, context)
          : undefined,
      };

      return ok(secureProps);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return err({
        code: 'SECURE_TEST.SECRETREF_CREATION_FAILED',
        title: 'SecretRef Creation Failed',
        detail: `Failed to create SecureTest with SecretRef: ${errorMessage}`,
        category: 'application',
        retryable: false,
        context: {
          requestId: request.id,
          tenantId: context.tenant,
        },
      });
    }
  }

  /**
   * Create signing secret SecretRef
   */
  private createSigningSecretRef(
    request: CreateSecureTestProps,
    context: ActorContext,
  ): SecureTestSecretRef {
    return SecureTestSecretRefFactory.createSigningSecretRef(
      context.tenant,
      'notification.webhook-config.secure-test',
      `${request.id}/signing-secret`,
    );
  }

  /**
   * Create username SecretRef
   */
  private createUsernameSecretRef(
    request: CreateSecureTestProps,
    context: ActorContext,
  ): SecureTestSecretRef {
    return SecureTestSecretRefFactory.createAuthSecretRef(
      context.tenant,
      'notification.webhook-config.secure-test',
      'username',
      `${request.id}/username`,
    );
  }

  /**
   * Create password SecretRef
   */
  private createPasswordSecretRef(
    request: CreateSecureTestProps,
    context: ActorContext,
  ): SecureTestSecretRef {
    return SecureTestSecretRefFactory.createAuthSecretRef(
      context.tenant,
      'notification.webhook-config.secure-test',
      'password',
      `${request.id}/password`,
    );
  }
}
