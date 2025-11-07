import {
  SecretRefUnion,
  DopplerSecretRef,
  SealedSecretRef,
  validateSecretRef,
  isDopplerSecretRef,
  isSealedSecretRef,
  createDopplerSecretRef,
  createSealedSecretRef,
} from '../domain/sealed-secret-ref.types';

/**
 * Shared SecretRef Utilities
 *
 * Provides high-level, domain-agnostic utilities for working with SecretRef objects.
 * These utilities handle common operations like JSON serialization, validation,
 * and smart SecretRef creation that can be reused across all bounded contexts.
 *
 * @domain Shared Infrastructure - SecretRef Utilities
 * @layer Infrastructure
 * @pattern Utility Pattern
 */
export class SecretRefUtils {
  /**
   * Parse and validate SecretRef from stored JSON string
   *
   * Safely parses a JSON string and validates it as a SecretRefUnion.
   * Returns null if parsing fails or validation fails.
   *
   * @param jsonString - JSON string representation of a SecretRef
   * @returns Parsed and validated SecretRefUnion or null if invalid
   */
  static parseSecretRefFromJSON(jsonString: string): SecretRefUnion | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(jsonString);

      if (this.validateSecretRefUnion(parsed)) {
        return parsed;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Serialize SecretRef to JSON string for storage
   *
   * Validates the SecretRef and converts it to a JSON string for storage.
   * Throws an error if the SecretRef is invalid.
   *
   * @param ref - SecretRefUnion object to serialize
   * @returns JSON string representation
   * @throws Error if SecretRef is invalid
   */
  static serializeSecretRefToJSON(ref: SecretRefUnion): string {
    if (!this.validateSecretRefUnion(ref)) {
      throw new Error('Invalid SecretRef cannot be serialized');
    }

    return JSON.stringify(ref);
  }

  /**
   * Validate SecretRefUnion object (supports both doppler and sealed)
   *
   * @param ref - Object to validate
   * @returns True if valid SecretRefUnion
   */
  static validateSecretRefUnion(ref: unknown): ref is SecretRefUnion {
    return validateSecretRef(ref);
  }

  /**
   * Check if SecretRef is Doppler type
   *
   * @param ref - SecretRefUnion to check
   * @returns True if Doppler SecretRef
   */
  static isDopplerSecretRef(ref: SecretRefUnion): ref is DopplerSecretRef {
    return isDopplerSecretRef(ref);
  }

  /**
   * Check if SecretRef is Sealed type
   *
   * @param ref - SecretRefUnion to check
   * @returns True if Sealed SecretRef
   */
  static isSealedSecretRef(ref: SecretRefUnion): ref is SealedSecretRef {
    return isSealedSecretRef(ref);
  }

  /**
   * Create a Doppler SecretRef with smart field parsing
   *
   * Parses a dot-separated field path to extract namespace and key.
   * Format: "notification.slack.token" -> namespace: "notification", key: "slack.token"
   *
   * @param baseKey - Dot-separated field path
   * @param tenant - Tenant identifier (defaults to 'core')
   * @param options - Additional options for the SecretRef
   * @returns DopplerSecretRef object
   */
  static createDopplerSecretRefForField(
    baseKey: string,
    tenant: string = 'core',
    options: {
      version?: string;
      algHint?: string;
    } = {},
  ): DopplerSecretRef {
    // Parse field path to extract namespace and key
    const parts = baseKey.split('.');
    const namespace = parts[0] || 'default';
    const key = parts.slice(1).join('.') || baseKey;

    return createDopplerSecretRef(tenant, namespace, key, {
      version: options.version || 'latest',
      algHint: options.algHint || 'doppler-v1',
    });
  }

  /**
   * Create a Sealed SecretRef for field-based encryption
   *
   * Creates a Sealed SecretRef with proper KEK handling and context-aware AAD.
   * Uses mock encryption - in production, this should use real encryption.
   *
   * @param tenant - Tenant identifier
   * @param context - Context for AAD (e.g., field name or domain context)
   * @param algorithm - Encryption algorithm (defaults to XChaCha20-Poly1305)
   * @param options - Additional options
   * @returns SealedSecretRef object
   */
  static createSealedSecretRefForField(
    tenant: string,
    context: string,
    algorithm: 'XCHACHA20-POLY1305' | 'AES-256-GCM' = 'XCHACHA20-POLY1305',
    options: {
      version?: number;
      additionalData?: Record<string, unknown>;
    } = {},
  ): SealedSecretRef {
    // ⚠️ SECURITY WARNING: This is mock encryption for development
    // In production, this must use real encryption with proper KEKs
    const mockBlob = Buffer.from(
      JSON.stringify({
        context,
        tenant,
        timestamp: Date.now(),
        mockEncryption: true,
        ...options.additionalData,
      }),
    ).toString('base64');

    const kekKid = `TENANT_KEK_${tenant.toUpperCase()}_V1`;

    return createSealedSecretRef(tenant, kekKid, algorithm, mockBlob, {
      aad: context,
      v: options.version || 1,
    });
  }

  /**
   * Safely extract SecretRef from event data or other sources
   *
   * Handles both direct SecretRefUnion objects and JSON string representations.
   * Returns null if the field is not present or invalid.
   *
   * @param data - Source data object
   * @param fieldName - Name of the field containing the SecretRef
   * @returns SecretRefUnion or null
   */
  static extractSecretRefFromData(
    data: Record<string, unknown>,
    fieldName: string,
  ): SecretRefUnion | null {
    const field = data[fieldName];

    if (!field) {
      return null;
    }

    // If it's already a SecretRefUnion object
    if (typeof field === 'object' && this.validateSecretRefUnion(field)) {
      return field;
    }

    // If it's a JSON string, try to parse it
    if (typeof field === 'string') {
      return this.parseSecretRefFromJSON(field);
    }

    return null;
  }

  /**
   * Batch parse multiple SecretRef fields from data
   *
   * Efficiently extracts and parses multiple SecretRef fields from a data object.
   * Returns a map of field names to SecretRefUnion objects (only successful parses).
   *
   * @param data - Source data object
   * @param fieldNames - Array of field names to extract
   * @returns Map of field names to SecretRefUnion objects
   */
  static extractMultipleSecretRefs(
    data: Record<string, unknown>,
    fieldNames: string[],
  ): Map<string, SecretRefUnion> {
    const results = new Map<string, SecretRefUnion>();

    for (const fieldName of fieldNames) {
      const secretRef = this.extractSecretRefFromData(data, fieldName);
      if (secretRef) {
        results.set(fieldName, secretRef);
      }
    }

    return results;
  }
}
