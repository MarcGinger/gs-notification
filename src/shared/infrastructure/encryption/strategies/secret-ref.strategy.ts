/**
 * SecretRef Encryption Strategy
 *
 * Handles SecretRef encryption/decryption for structured secrets.
 * Wraps the existing EventEncryptionService with the strategy interface.
 *
 * @domain Shared Infrastructure - SecretRef Encryption Strategy
 * @layer Infrastructure
 * @pattern Strategy Pattern + Adapter Pattern
 */

import { Injectable } from '@nestjs/common';
import {
  EncryptionStrategy,
  EncryptionContext,
  EncryptedPayload,
  DecryptedPayload,
  EncryptionMetadata,
} from '../interfaces/event-encryption-factory.interface';
import { EventEncryptionService } from '../../secret-ref/infrastructure/event-encryption.service';
import { DomainEvent } from 'src/shared/domain/events';

@Injectable()
export class SecretRefStrategy implements EncryptionStrategy {
  readonly name = 'secret-ref';
  readonly version = '1.0.0';

  constructor(
    private readonly eventEncryptionService: EventEncryptionService,
  ) {}

  /**
   * Encrypt domain events using SecretRef encryption
   */
  encrypt<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<EncryptedPayload<T>> {
    // Type guard to ensure we're working with domain events
    if (!this.isDomainEventArray(payload)) {
      return Promise.resolve({
        data: payload,
        metadata: {
          encrypted: false,
          processedFields: [],
        },
      });
    }

    try {
      // Use existing EventEncryptionService for encryption
      const encryptedEvents =
        this.eventEncryptionService.encryptSensitiveFields(
          payload as readonly DomainEvent[],
          context.actor,
          {
            sensitiveFields: ['signingSecret', 'username', 'password'], // Default fields
            namespaceMap: {
              signingSecret: 'signing',
              username: 'auth',
              password: 'auth',
            },
            defaultNamespace: 'general',
          },
        );

      return Promise.resolve({
        data: [...encryptedEvents] as T,
        metadata: {
          encrypted: true,
          algorithm: 'XChaCha20-Poly1305',
          keyId: `tenant:${context.tenant}:secret-ref`,
          processedFields: ['signingSecret', 'username', 'password'],
        },
      });
    } catch (error) {
      throw new Error(
        `SecretRef encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Decrypt domain events using SecretRef decryption
   */
  decrypt<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<DecryptedPayload<T>> {
    // Type guard to ensure we're working with domain events
    if (!this.isDomainEventArray(payload)) {
      return Promise.resolve({
        data: payload,
        metadata: {
          decrypted: false,
          processedFields: [],
        },
      });
    }

    try {
      const sensitiveFields = ['signingSecret', 'username', 'password'];
      const decryptedEvents = (payload as DomainEvent[]).map((event) => {
        const eventData = event.data as Record<string, unknown>;

        // Extract SecretRef fields from event data
        const secretRefFields: Record<string, string | undefined> = {};

        // Process all sensitive fields (don't stop at first match)
        sensitiveFields.forEach((field) => {
          const value = eventData[field];

          if (value && typeof value === 'string') {
            // Check if it's actually a sealed secret JSON string
            if (this.isSealedSecretJson(value)) {
              secretRefFields[field] = value;
            }
          } else if (value && typeof value === 'object' && value !== null) {
            // Check if it's a sealed secret object
            if (this.isSealedSecretObject(value)) {
              secretRefFields[field] = JSON.stringify(value);
            }
          }
        });

        const hasSecrets = Object.keys(secretRefFields).length > 0;

        if (!hasSecrets) {
          return event; // No secrets to decrypt
        }

        // Decrypt the SecretRef fields
        const decryptedFields =
          this.eventEncryptionService.decryptSecretRefFields(
            secretRefFields,
            context.actor,
          );

        // Merge decrypted fields back into event data
        const decryptedData = { ...eventData };
        for (const [fieldName, decryptedValue] of Object.entries(
          decryptedFields,
        )) {
          if (decryptedValue !== undefined) {
            decryptedData[fieldName] = decryptedValue;
          }
        }

        return {
          ...event,
          data: decryptedData,
        };
      });

      return Promise.resolve({
        data: decryptedEvents as T,
        metadata: {
          decrypted: true,
          algorithm: 'XChaCha20-Poly1305',
          keyId: `tenant:${context.tenant}:secret-ref`,
          processedFields: sensitiveFields,
        },
      });
    } catch (error) {
      throw new Error(
        `SecretRef decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate metadata for SecretRef operations
   */
  getMetadata(
    context: EncryptionContext,
    operationType: 'encrypt' | 'decrypt',
  ): EncryptionMetadata {
    return {
      algorithm: 'XChaCha20-Poly1305',
      keyId: `tenant:${context.tenant}:secret-ref`,
      tenant: context.tenant,
      namespace: 'secret-ref',
      timestamp: context.timestamp.toISOString(),
      source: 'secret-ref-strategy',
      processedFields: ['signingSecret', 'username', 'password'],
      strategyVersion: this.version,
      operationType,
    };
  }

  /**
   * Check if SecretRef strategy can handle the payload
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canHandle<T>(payload: T, context: EncryptionContext): boolean {
    return this.isDomainEventArray(payload) && this.hasSensitiveFields(payload);
  }

  /**
   * Type guard to check if payload is an array of domain events
   */
  private isDomainEventArray<T>(payload: T): payload is DomainEvent[] & T {
    return (
      Array.isArray(payload) &&
      payload.length > 0 &&
      payload.every(
        (item) =>
          typeof item === 'object' &&
          item !== null &&
          'type' in item &&
          'data' in item &&
          'aggregateId' in item,
      )
    );
  }

  /**
   * Check if events contain sensitive fields that need encryption
   */
  private hasSensitiveFields<T>(payload: T): boolean {
    if (!Array.isArray(payload)) return false;

    const sensitiveFields = ['signingSecret', 'username', 'password'];
    return payload.some((event) => {
      if (typeof event !== 'object' || event === null || !('data' in event)) {
        return false;
      }
      const eventObj = event as { data: unknown };
      if (typeof eventObj.data !== 'object' || eventObj.data === null) {
        return false;
      }
      const data = eventObj.data as Record<string, unknown>;
      return sensitiveFields.some((field) => field in data);
    });
  }

  /**
   * Check if a string is a valid sealed secret JSON
   */
  private isSealedSecretJson(value: string): boolean {
    try {
      const parsed: unknown = JSON.parse(value);
      return this.isSealedSecretObject(parsed);
    } catch {
      return false;
    }
  }

  /**
   * Check if an object is a valid sealed secret
   */
  private isSealedSecretObject(value: unknown): boolean {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const obj = value as Record<string, unknown>;

    // Check for sealed secret structure
    return (
      typeof obj.scheme === 'string' &&
      obj.scheme === 'secret' &&
      typeof obj.provider === 'string' &&
      typeof obj.tenant === 'string' &&
      typeof obj.blob === 'string' &&
      typeof obj.v === 'number'
    );
  }
}
