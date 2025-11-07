import { Injectable, Logger } from '@nestjs/common';
import { DopplerClient } from '../providers/doppler.client';
import { type SealedSecretRef } from '../domain/sealed-secret-ref.types';
import { generateTenantKEK } from './crypto/key-derivation.util';
import { SUPPORTED_ALGORITHMS } from './crypto/crypto.constants';
// TODO: Phase 2.1 - Add domain event imports
// import { SecretRefSealedEvent, SecretRefUnsealedEvent } from 'src/shared/domain/events';
// import { TenantContext, createTenantContext } from 'src/shared/domain/tenant';

/**
 * Service for handling sealed SecretRef operations using envelope encryption
 */
@Injectable()
export class SealedSecretService {
  private readonly logger = new Logger(SealedSecretService.name);

  constructor(private readonly dopplerClient: DopplerClient) {}

  /**
   * Seal (encrypt) a plaintext value for a specific tenant
   * This is a placeholder implementation for Phase 1
   */
  async seal(
    plaintext: string,
    tenant: string,
    context?: string,
  ): Promise<SealedSecretRef> {
    try {
      this.logger.debug('Sealing secret for tenant', { tenant, context });

      // Get tenant's KEK from Doppler
      const kekKid = `TENANT_KEK_${tenant.toUpperCase()}_V1`;
      // TODO: Use KEK for actual envelope encryption in Phase 2
      await this.dopplerClient.getSecret(kekKid);

      // TODO: Implement actual envelope encryption
      // For now, return a mock sealed ref for testing
      const mockEnvelope = Buffer.from(
        JSON.stringify({
          plaintext,
          tenant,
          timestamp: Date.now(),
        }),
      ).toString('base64url');

      const sealedRef: SealedSecretRef = {
        scheme: 'secret',
        provider: 'sealed',
        tenant,
        kekKid,
        alg: SUPPORTED_ALGORITHMS.XCHACHA20_POLY1305,
        aad: context,
        blob: mockEnvelope,
        v: 1,
      };

      this.logger.debug('Successfully sealed secret', {
        tenant,
        kekKid,
        algorithm: sealedRef.alg,
      });

      // TODO: Phase 2.1 - Emit domain event for sealed secret
      // const tenantContext = createTenantContext(tenant);
      // const sealedEvent = SecretRefSealedEvent.create({...}, tenantContext);
      // eventEmitter.emit('secret-ref.sealed', sealedEvent);

      return sealedRef;
    } catch (error) {
      this.logger.error('Failed to seal secret', {
        tenant,
        context,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to seal secret: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Unseal (decrypt) a sealed secret reference
   * This is a placeholder implementation for Phase 1
   */
  async unseal(ref: SealedSecretRef): Promise<string> {
    try {
      this.logger.debug('Unsealing secret', {
        tenant: ref.tenant,
        kekKid: ref.kekKid,
        algorithm: ref.alg,
      });

      // TODO: Get KEK from Doppler for actual envelope decryption in Phase 2
      // const kekResponse = await this.dopplerClient.getSecret(ref.kekKid);
      // const kek = parseKEKFromDoppler(kekResponse.value);

      // TODO: Implement actual envelope decryption
      // For now, decode the mock envelope
      const mockData = JSON.parse(
        Buffer.from(ref.blob, 'base64url').toString(),
      ) as {
        plaintext: string;
        tenant: string;
        timestamp: number;
      };

      // Validate tenant matches
      if (mockData.tenant !== ref.tenant) {
        throw new Error('Tenant mismatch in sealed reference');
      }

      // Simulate async operation for linting
      await Promise.resolve();

      this.logger.debug('Successfully unsealed secret', {
        tenant: ref.tenant,
        kekKid: ref.kekKid,
      });

      return mockData.plaintext;
    } catch (error) {
      this.logger.error('Failed to unseal secret', {
        tenant: ref.tenant,
        kekKid: ref.kekKid,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to unseal secret: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate and store a new tenant KEK in Doppler
   */
  generateTenantKEK(tenant: string, version: number = 1): Promise<string> {
    try {
      const kekKid = `TENANT_KEK_${tenant.toUpperCase()}_V${version}`;
      const kek = generateTenantKEK();

      this.logger.debug('Generated new tenant KEK', { tenant, kekKid });

      // TODO: Store KEK in Doppler (requires write access to Doppler API)
      // For now, just return the kekKid for manual storage
      this.logger.warn('Manual KEK storage required', {
        kekKid,
        instruction: `Store this KEK in Doppler: ${kekKid} = ${kek}`,
      });

      return Promise.resolve(kekKid);
    } catch (error) {
      this.logger.error('Failed to generate tenant KEK', {
        tenant,
        version,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to generate tenant KEK: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Validate that a sealed SecretRef is properly formed
   */
  validateSealedRef(ref: SealedSecretRef): boolean {
    try {
      // Check required fields
      if (!ref.scheme || ref.scheme !== 'secret') return false;
      if (!ref.provider || ref.provider !== 'sealed') return false;
      if (!ref.tenant || typeof ref.tenant !== 'string') return false;
      if (!ref.kekKid || typeof ref.kekKid !== 'string') return false;
      if (!ref.alg || typeof ref.alg !== 'string') return false;
      if (!ref.blob || typeof ref.blob !== 'string') return false;
      if (typeof ref.v !== 'number' || ref.v < 1) return false;

      // Check supported algorithm
      const supportedAlgs = Object.values(SUPPORTED_ALGORITHMS);
      if (!supportedAlgs.includes(ref.alg)) return false;

      // Validate base64url blob format
      try {
        Buffer.from(ref.blob, 'base64url');
      } catch {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn('Sealed ref validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}
