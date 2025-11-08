import { Injectable, Inject } from '@nestjs/common';
import {
  EventEncryptionFactory,
  EncryptionResult,
  EncryptionMetadata,
  PIIEncryptionConfig,
} from '../encryption';
import { DataClassification } from '../../services/compliance';
import { Logger, APP_LOGGER } from '../../logging';

/**
 * PII Encryption Adapter
 *
 * Bridges PII classification system with field encryption for
 * automatic protection of classified PII fields at persistence boundary.
 *
 * Features:
 * - Automatic encryption based on PII classification
 * - Field-level encryption with metadata preservation
 * - Safe logging of encryption operations (no plaintext)
 * - Integration with existing compliance infrastructure
 *
 * @pattern Adapter Pattern for PII Protection
 * @layer Infrastructure - Compliance Integration
 */
@Injectable()
export class PIIEncryptionAdapter {
  constructor(
    private readonly eventEncryptionFactory: EventEncryptionFactory,
    @Inject(APP_LOGGER)
    private readonly logger: Logger,
  ) {}

  /**
   * Encrypt PII fields in data object based on classification
   */
  async encryptPIIFields(
    data: Record<string, unknown>,
    classification: DataClassification,
    tenant: string,
    correlationId?: string,
  ): Promise<EncryptionResult> {
    try {
      // Only encrypt if PII is detected and encryption is required
      if (!classification.containsPII || !classification.requiresEncryption) {
        return {
          events: [{ data }] as any[],
          metadata: {
            encryptionType: 'noop',
            processedEventCount: 1,
            encryptedEventCount: 0,
            skippedEventCount: 1,
            algorithm: 'none',
            encryptedFields: [],
            strategyMetadata: [{
              algorithm: 'none',
              keyId: 'none',
              tenant,
              namespace: 'pii',
              timestamp: new Date().toISOString(),
              source: 'pii-adapter',
              processedFields: [],
              strategyVersion: '1.0.0',
              operationType: 'encrypt' as const,
            }],
          },
        };
      }

      // Create PII encryption configuration
      const piiConfig: PIIEncryptionConfig = {
        type: 'pii',
        domain: 'compliance',
        tenant,
        correlationId,
      };

      // Create a mock actor context for PII encryption
      const mockActor = {
        userId: 'system',
        tenant,
        tenant_userId: 'system',
      };

      // Create a mock domain event with the data
      const mockEvent = {
        type: 'PIIDataEncryption',
        version: 1,
        occurredAt: new Date(),
        aggregateId: 'pii-data',
        aggregateType: 'PIIData',
        data,
        metadata: {
          actor: mockActor,
          correlationId: correlationId || 'pii-encryption',
          service: 'pii-encryption-adapter',
          timestampIso: new Date().toISOString(),
          eventVersion: '1.0',
          schemaVersion: '2023.1',
          source: 'compliance.pii-encryption',
        },
      };

      // Use the EventEncryptionFactory to encrypt
      const encryptionResult = await this.eventEncryptionFactory.encryptEvents(
        [mockEvent],
        mockActor,
        piiConfig,
      );

      // Log encryption operation (safe - no plaintext)
      if (this.logger) {
        this.logger.debug('PII fields encrypted for persistence', undefined, {
          encryptedCount: encryptionResult.metadata.encryptedEventCount,
          algorithm: encryptionResult.metadata.algorithm,
          tenant,
        });
      }

      return encryptionResult;
    } catch (error) {
      if (this.logger) {
        this.logger.error('PII encryption failed', undefined, { error: (error as Error).message });
      }

      // Return original data on encryption failure (fail-open for availability)
      return {
        events: [{ data }] as any[],
        metadata: {
          encryptionType: 'error',
          processedEventCount: 1,
          encryptedEventCount: 0,
          skippedEventCount: 1,
          algorithm: 'none',
          encryptedFields: [],
          strategyMetadata: [{
            algorithm: 'none',
            keyId: 'encryption-failed',
            tenant,
            namespace: 'pii',
            timestamp: new Date().toISOString(),
            source: 'pii-adapter-error',
            processedFields: [],
            strategyVersion: '1.0.0',
            operationType: 'encrypt' as const,
          }],
        },
      };
    }
  }

  /**
   * Safely convert value to string for encryption
   */
  private safeStringify(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean')
      return String(value);
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value);
  }

  /**
   * Get nested field value using dot notation path
   */
  private getNestedFieldValue(
    obj: Record<string, unknown>,
    path: string,
  ): unknown {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? current[key] : undefined;
    }, obj);
  }

  /**
   * Set nested field value using dot notation path
   */
  private setNestedFieldValue(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;

    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key] as Record<string, unknown>;
    }, obj);

    target[lastKey] = value;
  }

  /**
   * Create blind index for searchable PII fields
   * @deprecated This functionality should be implemented using EventEncryptionFactory
   */
  async createSearchIndex(value: string, tenant: string): Promise<string> {
    // For now, return a simple hash-based index
    const crypto = await import('crypto');
    return crypto.createHash('sha256').update(`${value}-${tenant}`).digest('hex');
  }

  /**
   * Check if a value is encrypted
   * @deprecated This functionality should be implemented using EventEncryptionFactory
   */
  isEncrypted(value: unknown): boolean {
    // Simple heuristic - encrypted values are typically base64 strings
    if (typeof value !== 'string') return false;
    try {
      return Buffer.from(value, 'base64').toString('base64') === value && value.length > 20;
    } catch {
      return false;
    }
  }
}
