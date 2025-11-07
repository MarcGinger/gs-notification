import { Injectable, Logger } from '@nestjs/common';
import { SecretRefService as BaseSecretRefService } from '../secret-ref.service';
import { SealedSecretService } from './sealed-secret.service';
import {
  type SecretRefUnion,
  type DopplerSecretRef,
  type SealedSecretRef,
  isDopplerSecretRef,
  isSealedSecretRef,
  createSealedSecretRef,
} from '../domain/sealed-secret-ref.types';

/**
 * Enhanced SecretRefService with support for both Doppler and Sealed providers
 */
@Injectable()
export class EnhancedSecretRefService {
  private readonly logger = new Logger(EnhancedSecretRefService.name);

  constructor(
    private readonly baseSecretRefService: BaseSecretRefService,
    private readonly sealedSecretService: SealedSecretService,
  ) {}

  /**
   * Resolve a secret reference (supports both doppler and sealed providers)
   */
  async resolveSecret(ref: SecretRefUnion): Promise<string> {
    try {
      if (isDopplerSecretRef(ref)) {
        // Use existing SecretRefService for Doppler secrets
        const result = await this.baseSecretRefService.resolve(ref);
        return result.value;
      } else if (isSealedSecretRef(ref)) {
        // Use SealedSecretService for sealed secrets
        return await this.sealedSecretService.unseal(ref);
      } else {
        throw new Error(
          `Unsupported SecretRef provider: ${(ref as { provider: string }).provider}`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to resolve secret', {
        provider: ref.provider,
        tenant: ref.tenant,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create a sealed SecretRef for new webhook configurations
   */
  async createSealedRef(
    plaintext: string,
    tenant: string,
    context?: string,
  ): Promise<SealedSecretRef> {
    try {
      return await this.sealedSecretService.seal(plaintext, tenant, context);
    } catch (error) {
      this.logger.error('Failed to create sealed ref', {
        tenant,
        context,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Convert a Doppler SecretRef to a Sealed SecretRef
   * This is useful for migration purposes
   */
  async migrateDopplerToSealed(
    dopplerRef: DopplerSecretRef,
    tenant: string,
    context?: string,
  ): Promise<SealedSecretRef> {
    try {
      // First resolve the Doppler secret to get plaintext
      const plaintext = await this.resolveSecret(dopplerRef);

      // Then create a sealed ref with the same plaintext
      return await this.createSealedRef(plaintext, tenant, context);
    } catch (error) {
      this.logger.error('Failed to migrate doppler to sealed ref', {
        tenant,
        context,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate a new tenant KEK
   */
  async generateTenantKEK(
    tenant: string,
    version: number = 1,
  ): Promise<string> {
    return await this.sealedSecretService.generateTenantKEK(tenant, version);
  }

  /**
   * Validate a SecretRef (supports both types)
   */
  validateSecretRef(ref: SecretRefUnion): boolean {
    if (isDopplerSecretRef(ref)) {
      // Basic validation for Doppler refs
      return !!(
        ref.scheme === 'secret' &&
        ref.provider === 'doppler' &&
        ref.tenant &&
        ref.namespace &&
        ref.key
      );
    } else if (isSealedSecretRef(ref)) {
      return this.sealedSecretService.validateSealedRef(ref);
    }

    return false;
  }

  /**
   * Batch resolve multiple secret references
   */
  async resolveSecrets(refs: SecretRefUnion[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    const resolvePromises = refs.map(async (ref) => {
      try {
        const value = await this.resolveSecret(ref);
        const key = this.getSecretKey(ref);
        results.set(key, value);
      } catch (error) {
        this.logger.error('Failed to resolve secret in batch', {
          provider: ref.provider,
          tenant: ref.tenant,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Don't throw, just skip this secret
      }
    });

    await Promise.all(resolvePromises);
    return results;
  }

  /**
   * Get a unique key for a SecretRef (for caching/identification)
   */
  private getSecretKey(ref: SecretRefUnion): string {
    if (isDopplerSecretRef(ref)) {
      return `doppler:${ref.tenant}:${ref.namespace}:${ref.key}`;
    } else if (isSealedSecretRef(ref)) {
      return `sealed:${ref.tenant}:${ref.kekKid}:${ref.blob.substring(0, 8)}`;
    }

    return 'unknown:invalid';
  }

  /**
   * Health check for both providers
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    doppler: { healthy: boolean; latencyMs?: number; error?: string };
    sealed: { healthy: boolean; error?: string };
  }> {
    try {
      // Check base service (Doppler)
      const dopplerHealth = await this.baseSecretRefService.healthCheck();

      // Check sealed service (basic validation)
      let sealedHealth: { healthy: boolean; error?: string };
      try {
        // Try to validate a mock sealed ref
        const mockRef = createSealedSecretRef(
          'core',
          'TENANT_KEK_CORE_V1',
          'XCHACHA20-POLY1305',
          'dGVzdA==', // base64 for 'test'
        );
        const isValid = this.sealedSecretService.validateSealedRef(mockRef);
        sealedHealth = { healthy: isValid };
      } catch (error) {
        sealedHealth = {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }

      return {
        healthy: dopplerHealth.healthy && sealedHealth.healthy,
        doppler: dopplerHealth,
        sealed: sealedHealth,
      };
    } catch (error) {
      return {
        healthy: false,
        doppler: {
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        sealed: { healthy: false, error: 'Health check failed' },
      };
    }
  }
}
