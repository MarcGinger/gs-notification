import { Injectable } from '@nestjs/common';
import { DomainEvent } from 'src/shared/domain/events';
import { ActorContext } from 'src/shared/application/context';
import {
  SecretRefUnion,
  createSealedSecretRef,
} from 'src/shared/infrastructure/secret-ref/domain/sealed-secret-ref.types';

/**
 * Configuration for sensitive field encryption
 */
export interface SensitiveFieldConfig {
  /** List of field names that contain sensitive data */
  sensitiveFields: string[];
  /** Namespace mapping for different field types */
  namespaceMap?: Record<string, string>;
  /** Default namespace for fields not in the map */
  defaultNamespace?: string;
}

/**
 * Structure of a parsed SecretRef object from JSON
 */
interface ParsedSecretRef {
  scheme: string;
  provider: string;
  blob: string;
  [key: string]: unknown;
}

/**
 * Structure of decrypted blob data (mock encryption format)
 */
interface MockEncryptedBlobData {
  plaintext: string;
  tenant: string;
  namespace: string;
  timestamp: number;
  mockEncryption: boolean;
}

/**
 * Type guard to check if object is a valid SecretRef
 */
function isValidSecretRef(obj: unknown): obj is ParsedSecretRef {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as ParsedSecretRef).scheme === 'string' &&
    typeof (obj as ParsedSecretRef).provider === 'string' &&
    typeof (obj as ParsedSecretRef).blob === 'string'
  );
}

/**
 * Type guard to check if object is valid blob data
 */
function isValidBlobData(obj: unknown): obj is MockEncryptedBlobData {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as MockEncryptedBlobData).plaintext === 'string' &&
    typeof (obj as MockEncryptedBlobData).tenant === 'string' &&
    typeof (obj as MockEncryptedBlobData).namespace === 'string'
  );
}

/**
 * Shared service for encrypting sensitive fields in domain events
 *
 * This service provides reusable functionality for:
 * - Detecting sensitive fields in domain events
 * - Converting plaintext values to SecretRef objects
 * - Creating encrypted storage representations
 *
 * SECURITY WARNING: Current implementation uses mock encryption (base64 encoding).
 * In production, this MUST use real XChaCha20-Poly1305 encryption with proper KEKs.
 *
 * @domain Shared Infrastructure
 * @layer Infrastructure
 * @pattern Service Pattern
 */
@Injectable()
export class EventEncryptionService {
  /**
   * Encrypt sensitive fields in domain events before persistence
   * Infrastructure layer responsibility - domain provides plaintext, we encrypt for storage
   *
   * @param events - Domain events to process
   * @param actor - Actor context containing tenant information
   * @param config - Configuration for sensitive field detection (required)
   * @returns Events with sensitive fields converted to SecretRef objects
   */
  encryptSensitiveFields(
    events: readonly DomainEvent[],
    actor: ActorContext,
    config: SensitiveFieldConfig,
  ): readonly DomainEvent[] {
    return events.map((event) => {
      // Cast event data to a record for processing
      const eventData = event.data as Record<string, unknown>;

      // Only encrypt events with sensitive data
      if (!this.hasSensitiveFields(eventData, config)) {
        return event;
      }

      const encryptedData = { ...eventData };

      // Convert plaintext secrets to SecretRef objects for storage
      for (const fieldName of config.sensitiveFields) {
        const fieldValue = eventData[fieldName];
        if (fieldValue && typeof fieldValue === 'string') {
          const namespace =
            config.namespaceMap?.[fieldName] ??
            config.defaultNamespace ??
            'general';
          encryptedData[fieldName] = this.createSecretRef(
            fieldValue,
            actor.tenant,
            namespace,
          );
        }
      }

      return { ...event, data: encryptedData };
    });
  }

  /**
   * Check if event data contains sensitive fields that need encryption
   *
   * @param eventData - Event data to check
   * @param config - Configuration for sensitive field detection (required)
   * @returns True if the event contains any sensitive fields
   */
  hasSensitiveFields(
    eventData: Record<string, unknown>,
    config: SensitiveFieldConfig,
  ): boolean {
    if (!eventData || typeof eventData !== 'object') {
      return false;
    }

    return config.sensitiveFields.some(
      (fieldName) =>
        eventData[fieldName] && typeof eventData[fieldName] === 'string',
    );
  }

  /**
   * Create SecretRef for sensitive data storage
   * Uses Sealed SecretRef for enhanced security with encrypted blobs
   *
   * SECURITY WARNING: This is a mock implementation that stores plaintext in base64.
   * In production, this MUST use real XChaCha20-Poly1305 encryption with proper KEKs.
   *
   * @param plaintextValue - The plaintext value to encrypt
   * @param tenant - Tenant identifier for KEK selection
   * @param namespace - Namespace for the secret (e.g., 'signing', 'auth', 'api')
   * @returns SecretRefUnion object for storage
   */
  createSecretRef(
    plaintextValue: string,
    tenant: string,
    namespace: string,
  ): SecretRefUnion {
    // Create KEK (Key Encryption Key) identifier for the tenant
    const kekKid = `TENANT_KEK_${tenant.toUpperCase()}_V1`;

    // ⚠️ SECURITY ISSUE: This is NOT actual encryption - just base64 encoding!
    // Real implementation must:
    // 1. Load actual KEK for the tenant from secure key management
    // 2. Generate random nonce for XChaCha20-Poly1305
    // 3. Encrypt plaintextValue with KEK + nonce + AAD
    // 4. Store encrypted ciphertext in blob (not plaintext)
    const mockEncryptedBlob = Buffer.from(
      JSON.stringify({
        plaintext: plaintextValue, // ⚠️ SECURITY RISK: Plaintext visible after base64 decode
        tenant,
        namespace,
        timestamp: Date.now(),
        mockEncryption: true, // Flag to indicate this is mock encryption
      }),
    ).toString('base64');

    // Create sealed SecretRef with XChaCha20-Poly1305 encryption format
    return createSealedSecretRef(
      tenant,
      kekKid,
      'XCHACHA20-POLY1305',
      mockEncryptedBlob,
      {
        aad: namespace, // Additional authenticated data
        v: 1, // Version
      },
    );
  }

  /**
   * Mock decryption method to resolve SecretRef objects back to plaintext
   *
   * ⚠️ SECURITY WARNING: This is a mock implementation for development only.
   * In production, this MUST use real decryption with proper KEK management.
   *
   * @param encryptedFields - Object containing SecretRef fields as JSON strings
   * @param actor - Actor context for tenant validation
   * @returns Object with decrypted plaintext values
   */
  decryptSecretRefFields(
    encryptedFields: Record<string, string | undefined>,
    actor: ActorContext,
  ): Record<string, string | undefined> {
    const decrypted: Record<string, string | undefined> = {};

    for (const [fieldName, secretRefJson] of Object.entries(encryptedFields)) {
      if (!secretRefJson) {
        decrypted[fieldName] = undefined;
        continue;
      }

      try {
        // Parse the SecretRef JSON with type validation
        const secretRefRaw = JSON.parse(secretRefJson);

        if (!isValidSecretRef(secretRefRaw)) {
          throw new Error(`Invalid SecretRef format for field ${fieldName}`);
        }

        if (
          secretRefRaw.scheme === 'secret' &&
          secretRefRaw.provider === 'sealed'
        ) {
          // Decode the mock encrypted blob (base64 -> JSON)
          const blobDataRaw = JSON.parse(
            Buffer.from(secretRefRaw.blob, 'base64').toString('utf-8'),
          );

          if (!isValidBlobData(blobDataRaw)) {
            throw new Error(`Invalid blob data format for field ${fieldName}`);
          }

          // Validate tenant matches
          if (blobDataRaw.tenant !== actor.tenant) {
            throw new Error(`Tenant mismatch for field ${fieldName}`);
          }

          // Extract the plaintext (mock decryption)
          decrypted[fieldName] = blobDataRaw.plaintext;
        } else {
          // For other SecretRef types, we'd need proper resolution
          // For now, just return undefined
          decrypted[fieldName] = undefined;
        }
      } catch (error) {
        console.warn(`Failed to decrypt field ${fieldName}:`, error);
        decrypted[fieldName] = undefined;
      }
    }

    return decrypted;
  }
}
