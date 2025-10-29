import { Injectable, Inject } from '@nestjs/common';
import {
  FieldEncryptionService,
  EncryptionResult,
  EncryptionMetadata,
  FIELD_ENCRYPTION_SERVICE,
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
    @Inject(FIELD_ENCRYPTION_SERVICE)
    private readonly encryptionService: FieldEncryptionService,
    @Inject(APP_LOGGER)
    private readonly logger: Logger,
  ) {}

  /**
   * Encrypt PII fields in data object based on classification
   */
  async encryptPIIFields(
    data: Record<string, unknown>,
    classification: DataClassification,
    tenantId: string,
    correlationId?: string,
  ): Promise<EncryptionResult> {
    const startTime = Date.now();
    const encryptedData = { ...data };
    const encryptedFields: string[] = [];

    try {
      // Only encrypt if PII is detected and encryption is required
      if (!classification.containsPII || !classification.requiresEncryption) {
        return {
          encryptedData,
          metadata: {
            keyId: 'none',
            algorithm: 'none',
            encryptedAt: new Date().toISOString(),
            encryptedFields: [],
            classificationSummary: {
              categoriesCount: classification.piiCategories.length,
              confidentialityLevel: classification.confidentialityLevel,
              requiresEncryption: false,
            },
          },
        };
      }

      // Encrypt fields identified as sensitive in classification
      for (const sensitiveField of classification.sensitiveFields) {
        const fieldValue = this.getNestedFieldValue(data, sensitiveField);

        if (fieldValue !== null && fieldValue !== undefined) {
          const encryptedField = await this.encryptionService.encrypt(
            this.safeStringify(fieldValue),
            tenantId,
          );

          this.setNestedFieldValue(
            encryptedData,
            sensitiveField,
            encryptedField,
          );
          encryptedFields.push(sensitiveField);
        }
      }

      const encryptionMetadata: EncryptionMetadata = {
        keyId: 'tenant-active-key', // Will be set by encryption service
        algorithm: 'aes-256-gcm',
        encryptedAt: new Date().toISOString(),
        encryptedFields,
        classificationSummary: {
          categoriesCount: classification.piiCategories.length,
          confidentialityLevel: classification.confidentialityLevel,
          requiresEncryption: classification.requiresEncryption,
        },
      };

      // Log encryption operation (safe - no plaintext)
      if (this.logger) {
        this.logger.debug('PII fields encrypted for persistence');
      }

      return {
        encryptedData,
        metadata: encryptionMetadata,
      };
    } catch (error) {
      if (this.logger) {
        this.logger.error('PII encryption failed');
      }

      // Return original data on encryption failure (fail-open for availability)
      // In production, you might want to fail-closed depending on security requirements
      return {
        encryptedData: data,
        metadata: {
          keyId: 'encryption-failed',
          algorithm: 'none',
          encryptedAt: new Date().toISOString(),
          encryptedFields: [],
          classificationSummary: {
            categoriesCount: classification.piiCategories.length,
            confidentialityLevel: classification.confidentialityLevel,
            requiresEncryption: classification.requiresEncryption,
          },
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
   */
  async createSearchIndex(value: string, tenantId: string): Promise<string> {
    return this.encryptionService.createBlindIndex(value, tenantId);
  }

  /**
   * Check if a value is encrypted
   */
  isEncrypted(value: unknown): boolean {
    return this.encryptionService.isEncrypted(value);
  }
}
