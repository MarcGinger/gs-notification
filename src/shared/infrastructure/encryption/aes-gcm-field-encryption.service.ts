import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  FieldEncryptionService,
  KeyProvider,
  EncryptedField,
  CipherText,
  EncryptionError,
  DecryptionError,
  KeyNotFoundError,
} from './types';
import { InMemoryKeyProvider } from './in-memory-key-provider';

/**
 * AES-256-GCM Field Encryption Service
 *
 * Implements field-level envelope encryption for PII protection
 * at the persistence boundary (writer repositories).
 *
 * Features:
 * - AES-256-GCM (AEAD) encryption with random IV per field
 * - Key rotation support via keyId in envelope
 * - Blind index generation for equality searches
 * - Tenant-isolated key management
 * - Tamper detection via authentication tag
 *
 * @pattern CQRS Encryption at Persistence Boundary
 * @layer Infrastructure - Encryption Service
 */
@Injectable()
export class AesGcmFieldEncryptionService implements FieldEncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96-bit IV for GCM
  private static readonly ENVELOPE_PREFIX = 'enc:gcm:';

  constructor(private readonly keyProvider: InMemoryKeyProvider) {}

  /**
   * Encrypt a plaintext value using AES-256-GCM with random IV
   */
  /**
   * Encrypt a plaintext value with AES-256-GCM
   * @param plaintext The value to encrypt
   * @param _tenantId Tenant identifier for isolation (currently unused in implementation)
   */
  async encrypt(plaintext: string, _tenantId: string): Promise<EncryptedField> {
    try {
      const { id: keyId, key } = await this.keyProvider.getActiveKey();

      // Generate random IV for this encryption operation
      const iv = crypto.randomBytes(AesGcmFieldEncryptionService.IV_LENGTH);

      // Create cipher and encrypt
      const cipher = crypto.createCipheriv(
        AesGcmFieldEncryptionService.ALGORITHM,
        key,
        iv,
      );
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);

      // Get authentication tag for tamper detection
      const authTag = cipher.getAuthTag();

      // Create envelope: enc:gcm:<keyId>:<iv_b64>:<ct_b64>:<tag_b64>
      const envelope: CipherText = `${AesGcmFieldEncryptionService.ENVELOPE_PREFIX}${keyId}:${iv.toString('base64')}:${ciphertext.toString('base64')}:${authTag.toString('base64')}`;

      return {
        v: envelope,
        classification: {
          category: 'encrypted',
          confidentiality: 'confidential',
          requiresEncryption: true,
        },
      };
    } catch (error) {
      throw new EncryptionError(
        `Failed to encrypt field: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'ENCRYPTION_FAILED',
      );
    }
  }

  /**
   * Decrypt an encrypted field envelope using AES-256-GCM
   */
  /**
   * Decrypt an encrypted field back to plaintext
   * @param encryptedField The encrypted field to decrypt
   * @param _tenantId Tenant identifier for isolation (currently unused in implementation)
   */
  async decrypt(
    encryptedField: EncryptedField,
    _tenantId: string,
  ): Promise<string> {
    try {
      const envelope = encryptedField.v;

      if (!this.isValidEnvelope(envelope)) {
        throw new DecryptionError('Invalid encryption envelope format');
      }

      // Parse envelope: enc:gcm:<keyId>:<iv_b64>:<ct_b64>:<tag_b64>
      const parts = envelope.split(':');
      if (parts.length !== 6 || parts[0] !== 'enc' || parts[1] !== 'gcm') {
        throw new DecryptionError('Malformed encryption envelope');
      }

      const [, , keyId, ivB64, ctB64, tagB64] = parts;

      // Get decryption key
      const key = await this.keyProvider.getKey(keyId);
      if (!key) {
        throw new KeyNotFoundError(keyId);
      }

      // Decode components
      const iv = Buffer.from(ivB64, 'base64');
      const ciphertext = Buffer.from(ctB64, 'base64');
      const authTag = Buffer.from(tagB64, 'base64');

      // Create decipher and decrypt
      const decipher = crypto.createDecipheriv(
        AesGcmFieldEncryptionService.ALGORITHM,
        key,
        iv,
      );
      decipher.setAuthTag(authTag);

      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');

      return plaintext;
    } catch (error) {
      if (
        error instanceof KeyNotFoundError ||
        error instanceof DecryptionError
      ) {
        throw error;
      }
      throw new DecryptionError(
        `Decryption operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if a value is an encrypted field envelope
   */
  isEncrypted(value: unknown): value is EncryptedField {
    return (
      typeof value === 'object' &&
      value !== null &&
      'v' in value &&
      typeof (value as Record<string, unknown>).v === 'string' &&
      this.isValidEnvelope((value as Record<string, unknown>).v as string)
    );
  }

  /**
   * Create a blind index for equality searches using HMAC-SHA256
   */
  createBlindIndex(value: string, tenantId: string): Promise<string> {
    try {
      // Use tenant-specific salt for key isolation
      const salt = `tenant:${tenantId}:blind-index`;

      // Normalize value (trim, lowercase) for consistent indexing
      const normalizedValue = value.trim().toLowerCase();

      // Create HMAC-SHA256 hash
      const hmac = crypto.createHmac('sha256', salt);
      hmac.update(normalizedValue);
      const blindIndex = hmac.digest('hex');

      return Promise.resolve(`blind:${blindIndex}`);
    } catch (error) {
      return Promise.reject(
        new EncryptionError(
          `Failed to create blind index: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'BLIND_INDEX_FAILED',
        ),
      );
    }
  }

  /**
   * Validate encryption envelope format
   */
  private isValidEnvelope(value: string): value is CipherText {
    if (typeof value !== 'string') return false;

    const parts = value.split(':');
    return (
      parts.length === 6 &&
      parts[0] === 'enc' &&
      parts[1] === 'gcm' &&
      parts[2].length > 0 && // keyId
      this.isValidBase64(parts[3]) && // IV
      this.isValidBase64(parts[4]) && // ciphertext
      this.isValidBase64(parts[5]) // auth tag
    );
  }

  /**
   * Validate Base64 encoding
   */
  private isValidBase64(value: string): boolean {
    try {
      return Buffer.from(value, 'base64').toString('base64') === value;
    } catch {
      return false;
    }
  }
}
