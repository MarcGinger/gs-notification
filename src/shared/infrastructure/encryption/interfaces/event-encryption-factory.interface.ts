/**
 * Event Encryption Factory Interface
 *
 * Defines the contract for bidirectional event encryption/decryption operations.
 * Provides symmetric encrypt/decrypt methods with consistent configuration.
 *
 * @domain Shared Infrastructure - Event Encryption Factory Interface
 * @layer Infrastructure
 * @pattern Factory Pattern + Interface Segregation
 */

import { DomainEvent } from 'src/shared/domain/events';
import { ActorContext } from 'src/shared/application/context';
import { EncryptionConfig } from '../encryption-config.types';

/**
 * Encryption context for strategy operations
 */
export interface EncryptionContext {
  actor: ActorContext;
  correlationId?: string;
  tenant: string;
  timestamp: Date;
}

/**
 * Encrypted payload result
 */
export interface EncryptedPayload<T> {
  data: T;
  metadata: {
    encrypted: boolean;
    algorithm?: string;
    keyId?: string;
    processedFields: string[];
  };
}

/**
 * Decrypted payload result
 */
export interface DecryptedPayload<T> {
  data: T;
  metadata: {
    decrypted: boolean;
    algorithm?: string;
    keyId?: string;
    processedFields: string[];
  };
}

/**
 * Enriched encryption metadata for observability
 */
export interface EncryptionMetadata {
  algorithm: string;
  keyId: string;
  tenant: string;
  namespace: string;
  timestamp: string;
  source: string;
  processedFields: string[];
  strategyVersion: string;
  operationType: 'encrypt' | 'decrypt';
}

/**
 * Encryption operation result
 */
export interface EncryptionResult<T = DomainEvent> {
  events: T[];
  metadata: {
    encryptionType: string;
    processedEventCount: number;
    encryptedEventCount: number;
    skippedEventCount: number;
    algorithm?: string;
    encryptedFields?: string[];
    strategyMetadata: EncryptionMetadata[];
  };
}

/**
 * Decryption operation result
 */
export interface DecryptionResult<T = DomainEvent> {
  events: T[];
  metadata: {
    encryptionType: string;
    processedEventCount: number;
    decryptedEventCount: number;
    skippedEventCount: number;
    algorithm?: string;
    decryptedFields?: string[];
    strategyMetadata: EncryptionMetadata[];
  };
}

/**
 * Strategy contract for consistent encryption/decryption operations
 */
export interface EncryptionStrategy {
  /**
   * Strategy name for identification
   */
  readonly name: string;

  /**
   * Strategy version for compatibility tracking
   */
  readonly version: string;

  /**
   * Encrypt payload using strategy-specific logic
   */
  encrypt<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<EncryptedPayload<T>>;

  /**
   * Decrypt payload using strategy-specific logic
   */
  decrypt<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<DecryptedPayload<T>>;

  /**
   * Get metadata about the encryption operation
   */
  getMetadata(
    context: EncryptionContext,
    operationType: 'encrypt' | 'decrypt',
  ): EncryptionMetadata;

  /**
   * Validate if this strategy can handle the given payload
   */
  canHandle<T>(payload: T, context: EncryptionContext): boolean;
}

/**
 * Main Event Encryption Factory Interface
 */
export interface IEventEncryptionFactory {
  /**
   * Encrypt events using specified configuration
   */
  encryptEvents<T = DomainEvent>(
    events: T[],
    actor: ActorContext,
    config: EncryptionConfig,
  ): Promise<EncryptionResult<T>>;

  /**
   * Decrypt events using specified configuration (symmetric operation)
   */
  decryptEvents<T = DomainEvent>(
    events: T[],
    actor: ActorContext,
    config: EncryptionConfig,
  ): Promise<DecryptionResult<T>>;
}

/**
 * Re-export config types from encryption-config.types
 */
export type { EncryptionConfig } from '../encryption-config.types';
