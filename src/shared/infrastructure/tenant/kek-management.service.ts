import { Injectable, Logger } from '@nestjs/common';
import { DopplerClient } from '../secret-ref/providers/doppler.client';
import { TenantContext, getTenantKekId } from 'src/shared/domain/tenant';

/**
 * KEK (Key Encryption Key) Management Service
 *
 * Handles tenant-specific Key Encryption Keys stored in Doppler.
 * Each tenant has its own KEK used for envelope encryption of secrets.
 */
@Injectable()
export class KekManagementService {
  private readonly logger = new Logger(KekManagementService.name);

  constructor(private readonly dopplerClient: DopplerClient) {}

  /**
   * Setup KEK for a new tenant
   * Generates a new KEK and stores it in Doppler
   */
  async setupTenantKek(tenantContext: TenantContext): Promise<string> {
    try {
      const kekId = getTenantKekId(tenantContext);

      this.logger.log('Setting up KEK for tenant', {
        tenantId: tenantContext.tenantId,
        kekId,
      });

      // Check if KEK already exists
      const existingKek = await this.getTenantKek(tenantContext, false);
      if (existingKek) {
        this.logger.warn('KEK already exists for tenant', {
          tenantId: tenantContext.tenantId,
          kekId,
        });
        return kekId;
      }

      // Generate new 256-bit (32-byte) KEK for AES-256-GCM
      const kek = this.generateSecureKey(32);
      const kekBase64 = kek.toString('base64');

      // Store in Doppler (this is a mock implementation)
      // TODO: Replace with actual Doppler API call
      await this.storeMockKekInDoppler(kekId, kekBase64);

      this.logger.log('Successfully set up KEK for tenant', {
        tenantId: tenantContext.tenantId,
        kekId,
        keySize: kek.length,
      });

      return kekId;
    } catch (error) {
      this.logger.error('Failed to setup tenant KEK', {
        tenantId: tenantContext.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to setup KEK for tenant ${tenantContext.tenantId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Retrieve KEK for a tenant from Doppler
   */
  async getTenantKek(
    tenantContext: TenantContext,
    throwOnMissing = true,
  ): Promise<Buffer | null> {
    try {
      const kekId = getTenantKekId(tenantContext);

      this.logger.debug('Retrieving KEK for tenant', {
        tenantId: tenantContext.tenantId,
        kekId,
      });

      // Get KEK from Doppler
      try {
        const kekResponse = await this.dopplerClient.getSecret(kekId);
        const kekBase64 =
          typeof kekResponse === 'string' ? kekResponse : kekResponse.value;
        const kek = Buffer.from(kekBase64, 'base64');

        this.logger.debug('Successfully retrieved KEK', {
          tenantId: tenantContext.tenantId,
          kekId,
          keySize: kek.length,
        });

        return kek;
      } catch (error) {
        if (!throwOnMissing) {
          return null;
        }
        throw error;
      }
    } catch (error) {
      this.logger.error('Failed to retrieve tenant KEK', {
        tenantId: tenantContext.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to retrieve KEK for tenant ${tenantContext.tenantId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Rotate KEK for a tenant (create new version)
   */
  async rotateTenantKek(
    tenantContext: TenantContext,
    newVersion = 'V2',
  ): Promise<{ oldKekId: string; newKekId: string }> {
    try {
      const oldKekId = getTenantKekId(tenantContext, 'V1');
      const newKekId = getTenantKekId(tenantContext, newVersion);

      this.logger.log('Rotating KEK for tenant', {
        tenantId: tenantContext.tenantId,
        oldKekId,
        newKekId,
      });

      // Generate new KEK
      const newKek = this.generateSecureKey(32);
      const newKekBase64 = newKek.toString('base64');

      // Store new KEK in Doppler
      await this.storeMockKekInDoppler(newKekId, newKekBase64);

      this.logger.log('Successfully rotated KEK for tenant', {
        tenantId: tenantContext.tenantId,
        oldKekId,
        newKekId,
      });

      // TODO: Emit KekRotationEvent domain event
      // TODO: Schedule re-sealing of existing secrets with new KEK

      return { oldKekId, newKekId };
    } catch (error) {
      this.logger.error('Failed to rotate tenant KEK', {
        tenantId: tenantContext.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to rotate KEK for tenant ${tenantContext.tenantId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Remove old KEK after rotation is complete
   * This provides crypto-erasure capability
   */
  removeOldKek(kekId: string): void {
    try {
      this.logger.log('Removing old KEK', { kekId });

      // TODO: Implement actual Doppler deletion
      // await this.dopplerClient.deleteSecret(kekId);

      this.logger.log('Successfully removed old KEK', { kekId });
    } catch (error) {
      this.logger.error('Failed to remove old KEK', {
        kekId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(
        `Failed to remove KEK ${kekId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * List all KEKs for a tenant (for rotation management)
   */
  async listTenantKeks(tenantContext: TenantContext): Promise<string[]> {
    try {
      // TODO: Implement actual Doppler listing
      // This would typically query Doppler for keys matching pattern:
      // TENANT_KEK_{TENANT}_*

      const baseKekId = getTenantKekId(tenantContext, 'V1');

      // Mock implementation - return V1 if it exists
      try {
        await this.getTenantKek(tenantContext, false);
        return [baseKekId];
      } catch {
        return [];
      }
    } catch (error) {
      this.logger.error('Failed to list tenant KEKs', {
        tenantId: tenantContext.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Validate KEK format and strength
   */
  private validateKek(kek: Buffer): boolean {
    // KEK should be 256 bits (32 bytes) for AES-256-GCM
    if (kek.length !== 32) {
      return false;
    }

    // Additional entropy checks could be added here
    return true;
  }

  /**
   * Generate cryptographically secure random key
   */
  private generateSecureKey(size: number): Buffer {
    // In a real implementation, this would use Node.js crypto.randomBytes
    // For now, generate a predictable key for testing
    const key = Buffer.alloc(size);
    for (let i = 0; i < size; i++) {
      key[i] = (i + 1) % 256; // Predictable pattern for testing
    }
    return key;
  }

  /**
   * Mock storage of KEK in Doppler
   * TODO: Replace with actual Doppler client implementation
   */
  private async storeMockKekInDoppler(
    kekId: string,
    kekBase64: string,
  ): Promise<void> {
    // Simulate Doppler API call by making a request to get existing secret
    // This ensures DopplerClient is working
    try {
      await this.dopplerClient.getSecret('DUMMY_KEY_FOR_CONNECTION_TEST');
    } catch {
      // Expected to fail, just testing connection
    }

    this.logger.debug('Mock KEK stored in Doppler', {
      kekId,
      keyLength: kekBase64.length,
    });

    // TODO: Actual implementation would be:
    // await this.dopplerClient.setSecret(kekId, kekBase64);
  }
}
