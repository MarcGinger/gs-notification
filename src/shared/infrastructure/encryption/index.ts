/**
 * Event Encryption Infrastructure Index
 *
 * Main entry point for the event encryption infrastructure.
 * Exports factory, module, strategies, and types for clean imports.
 *
 * @domain Shared Infrastructure - Event Encryption
 * @layer Infrastructure
 */

// Main factory and module
export { EventEncryptionFactory } from './event-encryption.factory';
export {
  EventEncryptionModule,
  type EncryptionModuleOptions,
} from './encryption.module';

// Strategies
export {
  NoopStrategy,
  SecretRefStrategy,
  PIIStrategy,
  HybridStrategy,
  type HybridConfig,
} from './strategies';

// Interfaces and types
export {
  type IEventEncryptionFactory,
  type EncryptionStrategy,
  type EncryptionContext,
  type EncryptedPayload,
  type DecryptedPayload,
  type EncryptionResult,
  type DecryptionResult,
  type EncryptionMetadata,
} from './interfaces/event-encryption-factory.interface';

export {
  type EncryptionConfig,
  type EncryptionType,
  type SecretEncryptionConfig,
  type PIIEncryptionConfig,
  type EnvEncryptionConfig,
  type NoopEncryptionConfig,
  type CustomEncryptionConfig,
  type CompositeEncryptionConfig,
  type SecretConfigOptions,
  type PIIConfigOptions,
  type HybridConfigOptions,
} from './encryption-config.types';
