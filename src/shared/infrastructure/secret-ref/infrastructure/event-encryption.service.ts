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
 * Default configuration for common sensitive fields
 */
const DEFAULT_SENSITIVE_FIELD_CONFIG: SensitiveFieldConfig = {
  sensitiveFields: [
    'signingSecret',
    'username',
    'password',
    'apiKey',
    'token',
    'secret',
  ],
  namespaceMap: {
    signingSecret: 'signing',
    username: 'auth',
    password: 'auth',
    apiKey: 'api',
    token: 'auth',
    secret: 'general',
  },
  defaultNamespace: 'general',
};

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
   * @param config - Configuration for sensitive field detection (optional, uses defaults)
   * @returns Events with sensitive fields converted to SecretRef objects
   */
  encryptSensitiveFields(
    events: readonly DomainEvent[],
    actor: ActorContext,
    config: SensitiveFieldConfig = DEFAULT_SENSITIVE_FIELD_CONFIG,
  ): readonly DomainEvent[] {
    return events.map((event) => {
      // Only encrypt events with sensitive data
      if (!this.hasSensitiveFields(event.data, config)) {
        return event;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const eventData = event.data as any;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const encryptedData = { ...eventData };

      // Convert plaintext secrets to SecretRef objects for storage
      for (const fieldName of config.sensitiveFields) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const fieldValue = eventData[fieldName];
        if (fieldValue && typeof fieldValue === 'string') {
          const namespace =
            config.namespaceMap?.[fieldName] ??
            config.defaultNamespace ??
            'general';
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
   * @param config - Configuration for sensitive field detection
   * @returns True if the event contains any sensitive fields
   */
  hasSensitiveFields(
    eventData: any,
    config: SensitiveFieldConfig = DEFAULT_SENSITIVE_FIELD_CONFIG,
  ): boolean {
    if (!eventData || typeof eventData !== 'object') {
      return false;
    }

    return config.sensitiveFields.some(
      (fieldName) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
        // Parse the SecretRef JSON
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const secretRef = JSON.parse(secretRefJson);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (secretRef.scheme === 'secret' && secretRef.provider === 'sealed') {
          // Decode the mock encrypted blob (base64 -> JSON)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
          const blobData = JSON.parse(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
            Buffer.from(secretRef.blob, 'base64').toString('utf-8'),
          );

          // Validate tenant matches
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (blobData.tenant !== actor.tenant) {
            throw new Error(`Tenant mismatch for field ${fieldName}`);
          }

          // Extract the plaintext (mock decryption)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
          decrypted[fieldName] = blobData.plaintext;
        } else {
          // For other SecretRef types, we'd need proper resolution
          // For now, just return undefined
          decrypted[fieldName] = undefined;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Failed to decrypt field ${fieldName}:`, error);
        decrypted[fieldName] = undefined;
      }
    }

    return decrypted;
  }
}
