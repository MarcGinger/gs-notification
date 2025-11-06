/**
 * SecretRef Migration Implementation - Application Service Layer
 *
 * This file contains the core implementation for mapping between different
 * data models in the SecureTest domain during the SecretRef migration.
 */

import { Injectable } from '@nestjs/common';
import { CreateSecureTestProps } from '../../domain/props';
import { SecureTestProps } from '../../domain/props';
import { SecureTestSecretRefFactory } from '../../domain/value-objects';
import { Result, err, ok, DomainError } from 'src/shared/errors';

/**
 * Context interface for secret mapping operations
 */
export interface SecretMappingContext {
  tenantId: string;
  namespace: string;
  requestId: string;
  userId?: string;
}

/**
 * Configuration for SecretRef creation
 */
export interface SecretRefConfig {
  tenant: string;
  namespace: string;
  version: string;
  keyPrefix?: string;
}

/**
 * Response interface for secure mapping results
 */
export interface SecureMappingResult {
  hasSigningSecret: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  secretReferences: {
    signingSecretRef?: string;
    usernameRef?: string;
    passwordRef?: string;
  };
}

/**
 * SecureTestSecretMappingService
 *
 * Core service responsible for converting between different data models
 * in the SecureTest domain. Handles the critical mapping from plaintext
 * API props to SecretRef-protected domain props.
 *
 * This service implements the Application Service Layer pattern and serves
 * as the primary interface for SecretRef operations in the domain.
 */
@Injectable()
export class SecureTestSecretMappingService {
  /**
   * Convert API request props to domain props with SecretRef protection
   *
   * This is the core method that transforms plaintext secrets into SecretRef
   * instances. The process involves:
   * 1. Validating input context and props
   * 2. Creating appropriate SecretRef instances using the factory
   * 3. Mapping non-sensitive fields directly
   * 4. Returning SecureTestProps with zero plaintext exposure
   *
   * @param createProps - Input props from API layer (contains plaintext)
   * @param context - Tenant and security context for SecretRef creation
   * @returns SecureTestProps with SecretRef instances (no plaintext)
   */
  async mapCreatePropsToSecureProps(
    createProps: CreateSecureTestProps,
    context: SecretMappingContext,
  ): Promise<Result<SecureTestProps, DomainError>> {
    try {
      // Validate required context
      if (!context?.tenantId || !context?.namespace) {
        return err({
          code: 'SECURE_TEST.INVALID_MAPPING_CONTEXT',
          title: 'Invalid Mapping Context',
          detail: 'Tenant ID and namespace are required for SecretRef mapping',
          category: 'validation',
          retryable: false,
          context: { context },
        });
      }

      // Create SecretRef configuration
      const secretConfig: SecretRefConfig = {
        tenant: context.tenantId,
        namespace: context.namespace,
        version: 'latest',
        keyPrefix: createProps.id,
      };

      // Map basic fields that don't require SecretRef transformation
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
      // Each field gets its own SecretRef with appropriate naming convention
      const secureProps: SecureTestProps = {
        ...baseProps,

        // Signing secret SecretRef creation
        signingSecretRef: createProps.signingSecret
          ? this.createSigningSecretRef(createProps, secretConfig)
          : undefined,

        // Username SecretRef creation
        usernameRef: createProps.username
          ? this.createUsernameSecretRef(createProps, secretConfig)
          : undefined,

        // Password SecretRef creation
        passwordRef: createProps.password
          ? this.createPasswordSecretRef(createProps, secretConfig)
          : undefined,
      };

      return ok(secureProps);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      return err({
        code: 'SECURE_TEST.SECRETREF_MAPPING_FAILED',
        title: 'SecretRef Mapping Failed',
        detail: `Failed to map CreateSecureTestProps to SecureTestProps: ${errorMessage}`,
        category: 'application',
        retryable: false,
        context: {
          createPropsId: createProps.id,
          contextTenant: context.tenantId,
          error: errorStack,
        },
      });
    }
  }

  /**
   * Convert domain props to API response format (secure version)
   *
   * SECURITY NOTE: This method intentionally does NOT resolve SecretRef
   * values to plaintext. Instead, it returns metadata about secret
   * configuration that is safe to expose via API.
   *
   * @param secureProps - Domain props with SecretRef instances
   * @returns Safe API response data with secret metadata only
   */
  mapSecurePropsToResponseMetadata(
    secureProps: SecureTestProps,
  ): SecureMappingResult &
    Pick<
      CreateSecureTestProps,
      'id' | 'name' | 'description' | 'type' | 'signatureAlgorithm'
    > {
    return {
      // Basic fields (safe to expose)
      id: secureProps.id,
      name: secureProps.name,
      description: secureProps.description,
      type: secureProps.type,
      signatureAlgorithm: secureProps.signatureAlgorithm,

      // Secret existence indicators (safe metadata)
      hasSigningSecret: !!secureProps.signingSecretRef,
      hasUsername: !!secureProps.usernameRef,
      hasPassword: !!secureProps.passwordRef,

      // SecretRef identifiers (safe to expose as they're just references)
      secretReferences: {
        signingSecretRef: this.getSecretRefUri(secureProps.signingSecretRef),
        usernameRef: this.getSecretRefUri(secureProps.usernameRef),
        passwordRef: this.getSecretRefUri(secureProps.passwordRef),
      },
    };
  }

  /**
   * Validate mapping context for security compliance
   *
   * Ensures that all required security context is present before
   * performing any SecretRef operations.
   */
  validateMappingContext(
    context: SecretMappingContext,
  ): Result<void, DomainError> {
    const errors: string[] = [];

    if (!context.tenantId?.trim()) {
      errors.push('tenantId is required and cannot be empty');
    }

    if (!context.namespace?.trim()) {
      errors.push('namespace is required and cannot be empty');
    }

    if (!context.requestId?.trim()) {
      errors.push('requestId is required for audit logging');
    }

    // Validate tenant ID format (basic security check)
    if (context.tenantId && !/^[a-zA-Z0-9\-_.]+$/.test(context.tenantId)) {
      errors.push('tenantId contains invalid characters');
    }

    if (errors.length > 0) {
      return err({
        code: 'SECURE_TEST.INVALID_MAPPING_CONTEXT',
        title: 'Invalid Mapping Context',
        detail: `Invalid mapping context: ${errors.join(', ')}`,
        category: 'validation',
        retryable: false,
        context: { context, errors },
      });
    }

    return ok(undefined);
  }

  // Private helper methods for SecretRef creation

  /**
   * Create SecretRef for signing secret with appropriate naming
   */
  private createSigningSecretRef(
    createProps: CreateSecureTestProps,
    config: SecretRefConfig,
  ): ReturnType<typeof SecureTestSecretRefFactory.createSigningSecretRef> {
    const keyName = `${config.keyPrefix}-signing-secret`;

    return SecureTestSecretRefFactory.createSigningSecretRef(
      config.tenant,
      config.namespace,
      keyName,
      config.version,
    );
  }

  /**
   * Create SecretRef for username with appropriate naming
   */
  private createUsernameSecretRef(
    createProps: CreateSecureTestProps,
    config: SecretRefConfig,
  ): ReturnType<typeof SecureTestSecretRefFactory.createAuthSecretRef> {
    const keyName = `${config.keyPrefix}-username`;

    return SecureTestSecretRefFactory.createAuthSecretRef(
      config.tenant,
      config.namespace,
      'username',
      keyName,
      config.version,
    );
  }

  /**
   * Create SecretRef for password with appropriate naming
   */
  private createPasswordSecretRef(
    createProps: CreateSecureTestProps,
    config: SecretRefConfig,
  ): ReturnType<typeof SecureTestSecretRefFactory.createAuthSecretRef> {
    const keyName = `${config.keyPrefix}-password`;

    return SecureTestSecretRefFactory.createAuthSecretRef(
      config.tenant,
      config.namespace,
      'password',
      keyName,
      config.version,
    );
  }

  /**
   * Generate secure key names for SecretRef instances
   *
   * Creates deterministic but secure key names that:
   * - Include entity ID for uniqueness
   * - Include field type for clarity
   * - Follow consistent naming convention
   * - Are safe for storage systems
   */
  private generateSecretKeyName(
    entityId: string,
    fieldType: 'signing-secret' | 'username' | 'password',
    suffix?: string,
  ): string {
    const sanitizedId = entityId.replace(/[^a-zA-Z0-9\-_]/g, '_');
    const parts = [sanitizedId, fieldType];

    if (suffix) {
      parts.push(suffix);
    }

    return parts.join('-');
  }
}

/**
 * Migration-specific service for gradual rollout
 *
 * This service provides migration utilities for gradually rolling out
 * SecretRef functionality while maintaining backward compatibility.
 */
@Injectable()
export class SecureTestMigrationService {
  constructor(
    private readonly secretMappingService: SecureTestSecretMappingService,
  ) {}

  /**
   * Determine if SecretRef should be used for a given tenant
   *
   * Implements feature flag logic and gradual rollout strategy.
   */
  shouldUseSecretRef(
    tenantId: string,
    options: {
      enabled: boolean;
      whitelistedTenants: string[];
      rolloutPercentage: number;
    },
  ): boolean {
    // Feature flag check
    if (!options.enabled) {
      return false;
    }

    // Whitelist check (explicit inclusion)
    if (options.whitelistedTenants.includes(tenantId)) {
      return true;
    }

    // Percentage-based rollout using consistent hashing
    if (options.rolloutPercentage === 0) {
      return false;
    }

    if (options.rolloutPercentage >= 100) {
      return true;
    }

    // Consistent hash-based rollout
    const hash = this.hashTenantId(tenantId);
    return hash % 100 < options.rolloutPercentage;
  }

  /**
   * Create consistent hash for tenant ID
   *
   * Ensures that the same tenant always gets the same rollout decision
   * across multiple service restarts and deployments.
   */
  private hashTenantId(tenantId: string): number {
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) {
      const char = tenantId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get SecretRef URI for safe serialization
   *
   * Returns the raw URI if available, otherwise constructs one from components.
   * This is safe to expose as it only contains reference information.
   */
  private getSecretRefUri(secretRef?: SecureTestSecretRef): string | undefined {
    if (!secretRef) return undefined;

    return (
      secretRef.ref.raw ||
      `secret://${secretRef.ref.provider}/${secretRef.ref.tenant}/${secretRef.ref.namespace}/${secretRef.ref.key}`
    );
  }
}
