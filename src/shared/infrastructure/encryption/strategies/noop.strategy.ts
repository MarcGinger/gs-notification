/**
 * No-Operation Encryption Strategy
 *
 * Pass-through strategy that performs no encryption/decryption.
 * Useful for testing, development, and scenarios where encryption is not needed.
 *
 * @domain Shared Infrastructure - Noop Encryption Strategy
 * @layer Infrastructure
 * @pattern Strategy Pattern
 */

import { Injectable } from '@nestjs/common';
import {
  EncryptionStrategy,
  EncryptionContext,
  EncryptedPayload,
  DecryptedPayload,
  EncryptionMetadata,
} from '../interfaces/event-encryption-factory.interface';

@Injectable()
export class NoopStrategy implements EncryptionStrategy {
  readonly name = 'noop';
  readonly version = '1.0.0';

  /**
   * Pass-through encryption - returns data unchanged
   */
  encrypt<T>(
    payload: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: EncryptionContext,
  ): Promise<EncryptedPayload<T>> {
    return Promise.resolve({
      data: payload,
      metadata: {
        encrypted: false,
        processedFields: [],
      },
    });
  }

  /**
   * Pass-through decryption - returns data unchanged
   */
  decrypt<T>(
    payload: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: EncryptionContext,
  ): Promise<DecryptedPayload<T>> {
    return Promise.resolve({
      data: payload,
      metadata: {
        decrypted: false,
        processedFields: [],
      },
    });
  }

  /**
   * Generate metadata for noop operations
   */
  getMetadata(
    context: EncryptionContext,
    operationType: 'encrypt' | 'decrypt',
  ): EncryptionMetadata {
    return {
      algorithm: 'none',
      keyId: 'none',
      tenant: context.tenant,
      namespace: 'noop',
      timestamp: context.timestamp.toISOString(),
      source: 'noop-strategy',
      processedFields: [],
      strategyVersion: this.version,
      operationType,
    };
  }

  /**
   * Noop strategy can handle any payload
   */
  canHandle<T>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload: T,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context: EncryptionContext,
  ): boolean {
    return true;
  }
}
