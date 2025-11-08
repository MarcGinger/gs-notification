/**
 * Webhook Encryption Configuration
 *
 * Domain-specific encryption configuration for Webhook entities.
 * Centralizes field mappings and namespace configuration to ensure
 * consistency across Writer, Reader, Query repositories and Projector.
 *
 * @domain Notification - Webhook Config - Webhook
 * @layer Infrastructure - Configuration
 */

import { EncryptionConfig } from 'src/shared/infrastructure/encryption';
import { EventEncryptionFactory } from 'src/shared/infrastructure/encryption';

/**
 * Webhook domain-specific encryption field configuration
 */
export const WEBHOOK_ENCRYPTION_CONFIG = {
  /**
   * Fields that contain sensitive data requiring encryption
   * - signingSecret: Webhook signing secrets for verification
   * - headers: HTTP headers that may contain authorization tokens, API keys, etc.
   */
  SENSITIVE_FIELDS: ['signingSecret', 'headers'] as const,

  /**
   * Namespace mapping for different credential types
   * - signingSecret: Webhook-related secrets
   * - headers: HTTP headers (may contain auth tokens)
   */
  NAMESPACE_MAP: {
    signingSecret: 'webhook',
    headers: 'http',
  } as const,

  /**
   * Default namespace for general Webhook encryption operations
   */
  DEFAULT_NAMESPACE: 'webhook',
} as const;

/**
 * Webhook Encryption Configuration Helper
 *
 * Provides centralized configuration factory for Webhook domain encryption.
 * Ensures consistent field mappings and namespace configuration across all
 * Webhook repositories and projectors.
 */
export class WebhookEncryptionConfig {
  /**
   * Create PII encryption configuration for Webhook domain
   *
   * Uses PII strategy for compliance with data protection regulations.
   * Webhook data often contains personally identifiable information through
   * headers (authorization tokens) and signing secrets.
   *
   * @returns Configured EncryptionConfig for Webhook PII encryption
   */
  static createPIIConfig(tenant?: string): EncryptionConfig {
    return EventEncryptionFactory.createPIIConfig({
      domain: 'webhook-config',
      tenant,
    });
  }

  /**
   * Create SecretRef encryption configuration for Webhook domain
   *
   * @returns Configured EncryptionConfig for Webhook SecretRef encryption
   */
  static createSecretRefConfig(): EncryptionConfig {
    return EventEncryptionFactory.createSecretConfig({
      sensitiveFields: [...WEBHOOK_ENCRYPTION_CONFIG.SENSITIVE_FIELDS],
      namespaceMap: { ...WEBHOOK_ENCRYPTION_CONFIG.NAMESPACE_MAP },
      defaultNamespace: WEBHOOK_ENCRYPTION_CONFIG.DEFAULT_NAMESPACE,
    });
  }

  /**
   * Create Doppler encryption configuration for Webhook domain
   *
   * @returns Configured EncryptionConfig for Webhook Doppler encryption
   */
  static createDopplerConfig(): EncryptionConfig {
    return EventEncryptionFactory.createDopplerConfig({
      sensitiveFields: [...WEBHOOK_ENCRYPTION_CONFIG.SENSITIVE_FIELDS],
      namespaceMap: { ...WEBHOOK_ENCRYPTION_CONFIG.NAMESPACE_MAP },
      defaultNamespace: WEBHOOK_ENCRYPTION_CONFIG.DEFAULT_NAMESPACE,
    });
  }

  /**
   * Get sensitive field names for Webhook domain
   *
   * @returns Array of field names that require encryption
   */
  static getSensitiveFields(): readonly string[] {
    return WEBHOOK_ENCRYPTION_CONFIG.SENSITIVE_FIELDS;
  }

  /**
   * Get namespace mapping for Webhook credentials
   *
   * @returns Mapping of field names to namespace identifiers
   */
  static getNamespaceMap(): typeof WEBHOOK_ENCRYPTION_CONFIG.NAMESPACE_MAP {
    return WEBHOOK_ENCRYPTION_CONFIG.NAMESPACE_MAP;
  }
}
