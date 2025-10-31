// Generic PII Protection Service - Handles encryption, masking, and data anonymization
// Compliant with GDPR Article 32 (Security of processing) and HIPAA Security Rule
// Can be used across all domains for consistent data protection

import { Injectable, Inject } from '@nestjs/common';
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';
import { DataClassification, PIICategory } from './pii-classification.service';
import { AppConfigUtil } from '../../config/app-config.util';

/**
 * Key Provider Interface for flexible key management
 */
export interface KeyProvider {
  getKey(keyId?: string): Buffer;
}

/**
 * Default environment-based key provider
 */
@Injectable()
export class EnvironmentKeyProvider implements KeyProvider {
  getKey(keyId?: string): Buffer {
    const config = AppConfigUtil.getDataProtectionConfig();
    const keyString = keyId
      ? process.env[`PII_KEY_${keyId.toUpperCase()}`] || 'fallback-key'
      : config.pii.encryptionKey;

    // Derive 32-byte key using SHA-256
    return createHash('sha256').update(keyString).digest();
  }
}

// DI token for KeyProvider
export const KEY_PROVIDER = Symbol('KEY_PROVIDER');

/**
 * PII Protection Strategies
 */
export enum ProtectionStrategy {
  NONE = 'none',
  MASK = 'mask', // Replace with asterisks (reversible with key)
  HASH = 'hash', // One-way hash (irreversible)
  ENCRYPT = 'encrypt', // AES encryption (reversible with key)
  ANONYMIZE = 'anonymize', // Remove/replace with generic values
  PSEUDONYMIZE = 'pseudonymize', // Replace with consistent pseudonyms
}

/**
 * PII Protection Configuration
 */
interface ProtectionConfig {
  strategy: ProtectionStrategy;
  keyId?: string; // Reference to encryption key
  preserveFormat?: boolean; // Maintain original format (e.g., phone: XXX-XXX-1234)
  auditTrail?: boolean; // Log protection operations
}

/**
 * Protection Result
 */
export interface ProtectionResult {
  originalValue: string;
  protectedValue: string;
  strategy: ProtectionStrategy;
  keyId?: string;
  reversible: boolean;
  timestamp: string;
}

// Helper type for mutable objects
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

/**
 * Generic GDPR/HIPAA compliant PII protection service
 *
 * Features:
 * - Field-level encryption/masking for any domain
 * - Reversible and irreversible protection strategies
 * - Audit trail for all operations
 * - Key management integration ready
 * - Format preservation options
 * - Configurable protection policies per domain
 */
@Injectable()
export class PIIProtectionService {
  constructor(
    @Inject(KEY_PROVIDER) private readonly keyProvider: KeyProvider,
  ) {}

  /**
   * Protect sensitive data based on classification
   */
  protectData<T extends Record<string, unknown>>(
    data: T,
    classification: DataClassification,
  ): { protectedData: T; protectionLog: ProtectionResult[] } {
    const protectedData = { ...data } as Mutable<T>;
    const protectionLog: ProtectionResult[] = [];

    // Only process if contains PII
    if (!classification.containsPII) {
      return { protectedData, protectionLog };
    }

    // Apply protection to each sensitive field
    classification.sensitiveFields.forEach((fieldName) => {
      const value = data[fieldName];
      if (typeof value === 'string') {
        const config = this.getProtectionConfig(
          fieldName,
          classification.piiCategories,
        );

        const result = this.applyProtection(value, config);
        (protectedData as Record<string, unknown>)[fieldName] =
          result.protectedValue;
        protectionLog.push(result);
      }
    });

    return { protectedData, protectionLog };
  }

  /**
   * Restore protected data (if reversible)
   */
  restoreData<T extends Record<string, unknown>>(
    protectedData: T,
    protectionLog: ProtectionResult[],
  ): T {
    const restoredData = { ...protectedData } as Mutable<T>;

    protectionLog.forEach((logEntry) => {
      if (logEntry.reversible) {
        // Find field name from protection log
        const fieldName = Object.keys(protectedData).find(
          (key) => protectedData[key] === logEntry.protectedValue,
        );

        if (fieldName) {
          const restored = this.reverseProtection(
            logEntry.protectedValue,
            logEntry.strategy,
            logEntry.keyId,
          );
          (restoredData as Record<string, unknown>)[fieldName] = restored;
        }
      }
    });

    return restoredData;
  }

  /**
   * Create a masked copy for safe logging (no reversible data)
   * This is used to log command payloads without exposing PII
   */
  maskForLog<T extends Record<string, unknown>>(
    data: T,
    classification: DataClassification,
  ): T {
    if (!classification.containsPII) {
      return data; // No PII, safe to log as-is
    }

    const maskedData = { ...data } as Mutable<T>;

    // Mask each sensitive field with irreversible placeholders
    classification.sensitiveFields.forEach((fieldName) => {
      const value = data[fieldName];
      if (typeof value === 'string') {
        // Apply irreversible masking for logs
        (maskedData as Record<string, unknown>)[fieldName] = this.createLogMask(
          value,
          fieldName,
        );
      }
    });

    return maskedData;
  }

  /**
   * Create irreversible mask for logging (no encryption keys needed)
   */
  private createLogMask(value: string, fieldName: string): string {
    // Create deterministic but irreversible masks
    if (value.includes('@')) {
      // Email: keep domain, mask local part
      const [, domain] = value.split('@');
      return `***@${domain}`;
    }

    if (/^\d+$/.test(value) && value.length >= 8) {
      // Numbers (phone, ID): show last 4 digits
      return '***' + value.slice(-4);
    }

    if (value.length > 10) {
      // Long strings: show first and last char
      return value[0] + '***' + value[value.length - 1];
    }

    // Default: replace with field-specific placeholder
    return `[${fieldName.toUpperCase()}_REDACTED]`;
  }

  /**
   * Get protection configuration based on field and PII categories
   */
  private getProtectionConfig(
    fieldName: string,
    piiCategories: PIICategory[],
  ): ProtectionConfig {
    // High-security categories require encryption
    if (
      piiCategories.includes(PIICategory.FINANCIAL) ||
      piiCategories.includes(PIICategory.HEALTH) ||
      piiCategories.includes(PIICategory.SENSITIVE)
    ) {
      return {
        strategy: ProtectionStrategy.ENCRYPT,
        keyId: 'high-security-key',
        auditTrail: true,
      };
    }

    // Contact info gets masked with format preservation
    if (piiCategories.includes(PIICategory.CONTACT_INFO)) {
      return {
        strategy: ProtectionStrategy.MASK,
        preserveFormat: true,
        auditTrail: true,
      };
    }

    // Default for personal identifiers
    return {
      strategy: ProtectionStrategy.PSEUDONYMIZE,
      auditTrail: true,
    };
  }

  /**
   * Apply protection strategy to a value
   */
  private applyProtection(
    value: string,
    config: ProtectionConfig,
  ): ProtectionResult {
    let protectedValue: string;
    let reversible = false;

    switch (config.strategy) {
      case ProtectionStrategy.MASK:
        protectedValue = this.maskValue(value, config.preserveFormat);
        reversible = false; // Masking is typically irreversible
        break;

      case ProtectionStrategy.ENCRYPT:
        protectedValue = this.encryptValueGcm(value, config.keyId);
        reversible = true;
        break;

      case ProtectionStrategy.HASH:
        protectedValue = this.hashValue(value);
        reversible = false;
        break;

      case ProtectionStrategy.PSEUDONYMIZE:
        protectedValue = this.pseudonymizeValue(value);
        reversible = true; // If we maintain mapping table
        break;

      case ProtectionStrategy.ANONYMIZE:
        protectedValue = this.anonymizeValue(value);
        reversible = false;
        break;

      default:
        protectedValue = value;
        reversible = false;
    }

    return {
      originalValue: value,
      protectedValue,
      strategy: config.strategy,
      keyId: config.keyId,
      reversible,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Mask sensitive data with non-reversible, format-aware masking
   */
  private maskValue(value: string, preserveFormat = false): string {
    if (!preserveFormat) {
      return '*'.repeat(Math.min(value.length, 8));
    }

    // Format-aware masking
    if (this.isEmail(value)) {
      return this.maskEmail(value);
    }

    if (this.isPhone(value)) {
      return this.maskLast4Digits(value);
    }

    if (this.isAccountNumber(value)) {
      return this.maskLast4Digits(value);
    }

    // Default masking - preserve first and last character if long enough
    if (value.length <= 2) {
      return '*'.repeat(value.length);
    }
    if (value.length <= 4) {
      return value.charAt(0) + '*'.repeat(value.length - 2) + value.slice(-1);
    }

    return (
      value.substring(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2)
    );
  }

  /**
   * Email-specific masking
   */
  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return '[REDACTED]';

    const maskedLocal = localPart.length <= 1 ? '*' : `${localPart[0]}***`;

    return `${maskedLocal}@${domain}`;
  }

  /**
   * Mask all but last 4 digits while preserving format
   */
  private maskLast4Digits(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 4) return '[REDACTED]';

    const lastFour = digits.slice(-4);

    // Replace digits with asterisks while preserving format
    const masked = value.replace(/\d/g, '*');

    // Restore last 4 digits
    let digitCount = 0;
    let result = '';
    for (let i = masked.length - 1; i >= 0; i--) {
      if (masked[i] === '*' && digitCount < 4) {
        result = lastFour[3 - digitCount] + result;
        digitCount++;
      } else {
        result = masked[i] + result;
      }
    }

    return result;
  }

  /**
   * Encrypt sensitive data using AES-256-GCM with authentication
   */
  private encryptValueGcm(plaintext: string, keyId?: string): string {
    const key = this.keyProvider.getKey(keyId);
    const iv = randomBytes(12); // 96-bit IV for GCM
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return `enc:gcm:${iv.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`;
  }

  /**
   * Decrypt AES-256-GCM encrypted value
   */
  private decryptValueGcm(payload: string, keyId?: string): string {
    if (!payload.startsWith('enc:gcm:')) {
      return payload; // Not encrypted
    }

    const parts = payload.split(':');
    if (parts.length !== 5) {
      throw new Error('Invalid encrypted payload format');
    }

    const [, , ivB64, ctB64, tagB64] = parts;
    const key = this.keyProvider.getKey(keyId);
    const iv = Buffer.from(ivB64, 'base64');
    const ciphertext = Buffer.from(ctB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }

  /**
   * Hash sensitive data (irreversible) using SHA-256
   */
  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  /**
   * Create pseudonym for value with tenant-specific salt
   */
  private pseudonymizeValue(value: string, tenant = 'default'): string {
    const dataProtectionConfig = AppConfigUtil.getDataProtectionConfig();
    const salt = dataProtectionConfig.pii.pseudonymizationSalt;
    const hmac = createHash('sha256')
      .update(`${tenant}:${value}:${salt}`)
      .digest('hex');

    return `PSEUDO_${hmac.substring(0, 12).toUpperCase()}`;
  }

  /**
   * Anonymize by replacing with generic value
   */
  private anonymizeValue(value: string): string {
    if (this.isEmail(value)) return 'anonymous@example.com';
    if (this.isPhone(value)) return '000-000-0000';
    return '[REDACTED]';
  }

  /**
   * Reverse protection (if possible)
   */
  private reverseProtection(
    protectedValue: string,
    strategy: ProtectionStrategy,
    keyId?: string,
  ): string {
    switch (strategy) {
      case ProtectionStrategy.ENCRYPT:
        return this.decryptValueGcm(protectedValue, keyId);

      case ProtectionStrategy.PSEUDONYMIZE:
        // Would need pseudonym mapping table in production
        return '[PSEUDONYM_REVERSE_NOT_IMPLEMENTED]';

      default:
        return protectedValue; // Cannot reverse
    }
  }

  // Helper methods for pattern detection
  private isEmail(value: string): boolean {
    return /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(value);
  }

  private isPhone(value: string): boolean {
    return /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/.test(
      value,
    );
  }

  private isAccountNumber(value: string): boolean {
    return /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/.test(value);
  }

  /**
   * Generate audit entry for protection operation
   */
  generateProtectionAudit(
    results: ProtectionResult[],
    context: {
      userId: string;
      tenant: string;
      operation: string;
      domain?: string;
      entityType?: string;
    },
  ) {
    return {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      tenant: context.tenant,
      operation: context.operation,
      domain: context.domain || 'unknown',
      entityType: context.entityType || 'unknown',
      protectedFields: results.length,
      strategies: [...new Set(results.map((r) => r.strategy))],
      reversibleFields: results.filter((r) => r.reversible).length,
      purpose: 'data_protection_compliance',
      complianceFrameworks: ['GDPR_Article_32', 'HIPAA_Security_Rule'],
    };
  }
}
