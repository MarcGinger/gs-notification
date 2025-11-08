/**
 * Encryption Configuration Types
 *
 * Type definitions for different encryption strategies and configurations.
 * Supports bidirectional operations with consistent configuration.
 *
 * @domain Shared Infrastructure - Encryption Configuration Types
 * @layer Infrastructure
 * @pattern Configuration Pattern + Type Safety
 */

/**
 * Encryption type flags for different use cases
 */
export type EncryptionType =
  | 'noop' // No encryption - pass through events unchanged
  | 'secret' // SecretRef encryption for structured secrets (API keys, tokens, passwords)
  | 'doppler' // Doppler-specific SecretRef encryption
  | 'pii' // PII compliance encryption for personal data
  | 'env' // Environment variable encryption for configuration secrets
  | 'hybrid' // Pipeline of multiple encryption strategies
  | 'custom'; // Custom encryption strategy (future extensibility)

/**
 * Base configuration for all encryption types
 */
interface BaseEncryptionConfig {
  type: EncryptionType;
  correlationId?: string;
}

/**
 * SecretRef encryption configuration
 */
export interface SecretEncryptionConfig extends BaseEncryptionConfig {
  type: 'secret' | 'doppler';
  sensitiveFields: string[];
  namespaceMap?: Record<string, string>;
  defaultNamespace?: string;
}

/**
 * PII encryption configuration
 */
export interface PIIEncryptionConfig extends BaseEncryptionConfig {
  type: 'pii';
  domain: string;
  tenant?: string;
}

/**
 * Environment variable encryption configuration
 */
export interface EnvEncryptionConfig extends BaseEncryptionConfig {
  type: 'env';
  envFields: string[];
  keyPrefix?: string;
  keyManagement?: 'doppler' | 'aws-kms' | 'azure-keyvault';
}

/**
 * No-op encryption configuration
 */
export interface NoopEncryptionConfig extends BaseEncryptionConfig {
  type: 'noop';
}

/**
 * Custom encryption configuration (for future extensibility)
 */
export interface CustomEncryptionConfig extends BaseEncryptionConfig {
  type: 'custom';
  strategy: string;
  config: Record<string, unknown>;
}

/**
 * Composite encryption configuration for hybrid pipelines
 */
export interface CompositeEncryptionConfig extends BaseEncryptionConfig {
  type: 'hybrid';
  pipeline: EncryptionType[];
  strategies: {
    [K in EncryptionType]?: K extends 'secret' | 'doppler'
      ? Omit<SecretEncryptionConfig, 'type'>
      : K extends 'pii'
        ? Omit<PIIEncryptionConfig, 'type'>
        : K extends 'env'
          ? Omit<EnvEncryptionConfig, 'type'>
          : K extends 'custom'
            ? Omit<CustomEncryptionConfig, 'type'>
            : K extends 'noop'
              ? Omit<NoopEncryptionConfig, 'type'>
              : never;
  };
}

/**
 * Union type for all encryption configurations
 */
export type EncryptionConfig =
  | SecretEncryptionConfig
  | PIIEncryptionConfig
  | EnvEncryptionConfig
  | NoopEncryptionConfig
  | CustomEncryptionConfig
  | CompositeEncryptionConfig;

/**
 * Configuration options for static helpers
 */
export interface SecretConfigOptions {
  namespaceMap?: Record<string, string>;
  defaultNamespace?: string;
  correlationId?: string;
}

export interface PIIConfigOptions {
  domain: string;
  tenant?: string;
  correlationId?: string;
}

export interface HybridConfigOptions {
  correlationId?: string;
  strategies?: CompositeEncryptionConfig['strategies'];
}
