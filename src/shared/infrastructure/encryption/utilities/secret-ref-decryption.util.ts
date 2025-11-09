// Shared SecretRef Decryption Utility
// Common decryption patterns used across all bounded contexts

import { Log, Logger } from 'src/shared/logging';
import { ActorContext } from 'src/shared/application/context';
import {
  EventEncryptionFactory,
  EncryptionConfig,
} from 'src/shared/infrastructure/encryption';

/**
 * Shared SecretRef Decryption Utility
 *
 * Generic utility for parsing and decrypting SecretRef fields from Redis storage.
 * This utility provides common decryption patterns that can be reused across
 * multiple bounded contexts (SecureTest, Webhook, Config, etc.).
 *
 * Common Decryption Pipeline:
 * 1. Parse JSON strings back to SecretRef objects
 * 2. Create domain event structure for SecretRefStrategy
 * 3. Decrypt using EventEncryptionFactory with domain-specific config
 * 4. Convert results back to string values for repository interfaces
 *
 * Used by domain-specific decryption utilities to eliminate cross-domain duplication
 * and ensure consistent decryption behavior throughout the application.
 *
 * @domain Shared Infrastructure - SecretRef Decryption
 * @layer Infrastructure
 * @pattern Utility Pattern + Shared Cross-Domain Logic
 */
export class SecretRefDecryptionUtil {
  /**
   * Parse and decrypt SecretRef fields using EventEncryptionFactory
   *
   * Generic method that works with any domain by accepting a domain-specific
   * encryption config. The repository layer has no knowledge of encryption formats -
   * the factory handles all encryption/decryption logic.
   *
   * @param secretFields - Record of field names to encrypted values (JSON strings or plain strings)
   * @param actor - Actor context for decryption
   * @param eventEncryptionFactory - Factory for handling encryption/decryption operations
   * @param encryptionConfig - Domain-specific encryption configuration
   * @param eventType - Event type for domain event structure (e.g., 'SecureTestQuery', 'WebhookQuery')
   * @param logger - Logger instance for error reporting
   * @param context - Additional context for logging (e.g., method name, domain)
   * @returns Promise resolving to record of field names to decrypted string values
   */
  static async decryptSecretRefFields(
    secretFields: Record<string, string | undefined>,
    actor: ActorContext,
    eventEncryptionFactory: EventEncryptionFactory,
    encryptionConfig: EncryptionConfig,
    eventType: string,
    logger: Logger,
    context?: { method?: string; domain?: string },
  ): Promise<Record<string, string | undefined>> {
    try {
      // Parse JSON strings back to objects (if they are JSON)
      const parsedFields: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(secretFields)) {
        if (value) {
          try {
            // Try to parse as JSON
            const parsed = JSON.parse(value) as unknown;
            parsedFields[key] = parsed;
          } catch {
            // Not JSON, treat as plain string
            parsedFields[key] = value;
          }
        }
      }

      // Create proper domain event structure for SecretRefStrategy
      const mockDomainEvent = {
        type: eventType,
        data: parsedFields,
        aggregateId: `${eventType.toLowerCase()}-${actor.tenant}-${Date.now()}`,
      };

      const decryptionResult = await eventEncryptionFactory.decryptEvents(
        [mockDomainEvent],
        actor,
        encryptionConfig,
      );

      // Extract data from the domain event structure
      const decryptedEvent = decryptionResult.events[0];
      const decryptedResult = decryptedEvent?.data || parsedFields;

      // Convert the result to string values for the repository interface
      const result: Record<string, string | undefined> = {};

      for (const [key, value] of Object.entries(decryptedResult)) {
        if (typeof value === 'string') {
          result[key] = value;
        } else if (value === null || value === undefined) {
          result[key] = undefined;
        } else {
          // EventEncryptionFactory should have decrypted this to a string
          // If it returned an object, that indicates the factory needs to be fixed
          result[key] = JSON.stringify(value);
        }
      }

      return result;
    } catch (error) {
      Log.error(logger, 'Failed to decrypt SecretRef fields', {
        method:
          context?.method || 'SecretRefDecryptionUtil.decryptSecretRefFields',
        domain: context?.domain || 'unknown',
        eventType,
        error: (error as Error).message,
        fieldKeys: Object.keys(secretFields),
      });
      // Return original values on error
      return secretFields;
    }
  }

  /**
   * Create domain event structure for SecretRef decryption
   *
   * Helper method to create consistent domain event structures across domains.
   * This ensures all domains follow the same pattern for SecretRefStrategy.
   *
   * @param eventType - Event type (e.g., 'SecureTestQuery', 'WebhookQuery')
   * @param data - Parsed field data
   * @param tenant - Tenant identifier
   * @returns Domain event structure
   */
  static createDomainEvent(
    eventType: string,
    data: Record<string, unknown>,
    tenant: string,
  ): { type: string; data: Record<string, unknown>; aggregateId: string } {
    return {
      type: eventType,
      data,
      aggregateId: `${eventType.toLowerCase()}-${tenant}-${Date.now()}`,
    };
  }

  /**
   * Parse JSON field values safely
   *
   * Helper method to parse JSON strings back to objects with error handling.
   * Handles both JSON strings (SecretRef objects) and plain strings consistently.
   *
   * @param secretFields - Record of field names to potentially JSON values
   * @returns Parsed fields with JSON objects converted and plain strings preserved
   */
  static parseJsonFields(
    secretFields: Record<string, string | undefined>,
  ): Record<string, unknown> {
    const parsedFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(secretFields)) {
      if (value) {
        try {
          // Try to parse as JSON
          const parsed = JSON.parse(value) as unknown;
          parsedFields[key] = parsed;
        } catch {
          // Not JSON, treat as plain string
          parsedFields[key] = value;
        }
      }
    }

    return parsedFields;
  }

  /**
   * Convert decrypted values to string format
   *
   * Helper method to convert decrypted results back to string values
   * for repository interfaces that expect string types.
   *
   * @param decryptedResult - Result from EventEncryptionFactory
   * @returns Record with all values converted to strings or undefined
   */
  static convertToStringValues(
    decryptedResult: Record<string, unknown>,
  ): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};

    for (const [key, value] of Object.entries(decryptedResult)) {
      if (typeof value === 'string') {
        result[key] = value;
      } else if (value === null || value === undefined) {
        result[key] = undefined;
      } else {
        // EventEncryptionFactory should have decrypted this to a string
        // If it returned an object, that indicates the factory needs to be fixed
        result[key] = JSON.stringify(value);
      }
    }

    return result;
  }
}
