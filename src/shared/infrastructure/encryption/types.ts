/**
 * Encryption Types and Interfaces for PII Protection
 *
 * Implements field-level envelope encryption using AES-256-GCM (AEAD)
 * with random 96-bit IV per field and key rotation support.
 *
 * @pattern CQRS Encryption at Persistence Boundary
 * @layer Infrastructure - Encryption
 */

/**
 * Encrypted field envelope format: enc:gcm:<keyId>:<iv_b64>:<ct_b64>:<tag_b64>
 */
export type CipherText = `enc:gcm:${string}:${string}:${string}:${string}`;

/**
 * Wrapper to prevent accidental use of encrypted fields in domain logic
 */
export interface EncryptedField {
  /** Encrypted value - should only be handled by encryption infrastructure */
  readonly v: CipherText;
  /** Field classification metadata (safe to log) */
  readonly classification?: {
    category: string;
    confidentiality: 'public' | 'internal' | 'confidential' | 'restricted';
    requiresEncryption: boolean;
  };
}

/**
 * Key management interface for encryption/decryption operations
 */
export interface KeyProvider {
  /**
   * Get encryption key by ID (for decryption of existing data)
   * @param keyId - The unique identifier of the key
   * @returns The encryption key buffer
   * @throws Error if key not found or access denied
   */
  getKey(keyId: string): Promise<Buffer>;

  /**
   * Get the currently active key for new encryption operations
   * @returns Object containing key ID and key buffer
   */
  getActiveKey(): Promise<{ id: string; key: Buffer }>;

  /**
   * Check if a key exists and is valid
   * @param keyId - The unique identifier of the key
   * @returns True if key exists and is accessible
   */
  hasKey(keyId: string): Promise<boolean>;
}

/**
 * Encryption service interface for field-level PII protection
 */
export interface FieldEncryptionService {
  /**
   * Encrypt a plaintext value using the active key
   * @param plaintext - The value to encrypt
   * @param tenant - Tenant context for key isolation
   * @returns Encrypted field envelope
   */
  encrypt(plaintext: string, tenant: string): Promise<EncryptedField>;

  /**
   * Decrypt an encrypted field envelope
   * @param encryptedField - The encrypted field to decrypt
   * @param tenant - Tenant context for key isolation
   * @returns Decrypted plaintext value
   */
  decrypt(encryptedField: EncryptedField, tenant: string): Promise<string>;

  /**
   * Check if a value is encrypted
   * @param value - The value to check
   * @returns True if the value is an encrypted envelope
   */
  isEncrypted(value: unknown): value is EncryptedField;

  /**
   * Create a blind index for equality searches (one-way hash)
   * @param value - The value to index
   * @param tenant - Tenant context for salt isolation
   * @returns Blind index hash for equality matching
   */
  createBlindIndex(value: string, tenant: string): Promise<string>;
}

/**
 * Configuration for field-level encryption
 */
export interface EncryptionConfig {
  /** Key provider implementation */
  keyProvider: KeyProvider;
  /** Algorithm to use (currently only aes-256-gcm supported) */
  algorithm: 'aes-256-gcm';
  /** IV length in bytes (12 for GCM) */
  ivLength: number;
  /** Whether to include classification metadata in encrypted fields */
  includeClassification: boolean;
}

/**
 * Metadata about encrypted data (safe to log and store)
 */
export interface EncryptionMetadata {
  /** Key ID used for encryption (safe to log) */
  keyId: string;
  /** Algorithm used */
  algorithm: string;
  /** Timestamp when encryption was performed */
  encryptedAt: string;
  /** Field names that were encrypted (safe to log) */
  encryptedFields: string[];
  /** Classification summary (safe to log) */
  classificationSummary?: {
    categoriesCount: number;
    confidentialityLevel: string;
    requiresEncryption: boolean;
  };
}

/**
 * Result of encryption operation
 */
export interface EncryptionResult {
  /** The encrypted data object */
  encryptedData: Record<string, unknown>;
  /** Metadata about the encryption operation */
  metadata: EncryptionMetadata;
}

/**
 * Error types for encryption operations
 */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class KeyNotFoundError extends EncryptionError {
  constructor(keyId: string) {
    super(`Encryption key not found: ${keyId}`, 'KEY_NOT_FOUND');
  }
}

export class DecryptionError extends EncryptionError {
  constructor(reason: string) {
    super(`Decryption failed: ${reason}`, 'DECRYPTION_FAILED');
  }
}
