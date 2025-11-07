import * as crypto from 'node:crypto';
import { CRYPTO_SIZES } from './crypto.constants';

/**
 * Derive a deterministic key from a master key and context information
 * Uses HKDF (HMAC-based Key Derivation Function) for secure key derivation
 */
export function deriveKey(
  masterKey: Buffer,
  context: string,
  keyLength: number = CRYPTO_SIZES.AES_256_KEY_SIZE,
): Buffer {
  if (masterKey.length < 16) {
    throw new Error('Master key must be at least 16 bytes');
  }

  if (keyLength < 16 || keyLength > 64) {
    throw new Error('Key length must be between 16 and 64 bytes');
  }

  // Use HKDF with SHA-256 to derive a key
  return Buffer.from(
    crypto.hkdfSync('sha256', masterKey, Buffer.alloc(0), context, keyLength),
  );
}

/**
 * Generate a secure random key of the specified length
 */
export function generateSecureKey(
  length: number = CRYPTO_SIZES.AES_256_KEY_SIZE,
): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Generate a secure random nonce of the specified length
 */
export function generateSecureNonce(length: number): Buffer {
  return crypto.randomBytes(length);
}

/**
 * Constant-time comparison of two buffers to prevent timing attacks
 */
export function constantTimeEquals(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

/**
 * Generate a cryptographically secure random tenant KEK
 * Returns a base64-encoded key suitable for storage in Doppler
 */
export function generateTenantKEK(): string {
  const kek = generateSecureKey(CRYPTO_SIZES.AES_256_KEY_SIZE);
  return kek.toString('base64');
}

/**
 * Parse a base64-encoded KEK from Doppler
 */
export function parseKEKFromDoppler(kekB64: string): Buffer {
  try {
    const kek = Buffer.from(kekB64, 'base64');

    if (kek.length !== CRYPTO_SIZES.AES_256_KEY_SIZE) {
      throw new Error(
        `Invalid KEK size: expected ${CRYPTO_SIZES.AES_256_KEY_SIZE} bytes, got ${kek.length}`,
      );
    }

    return kek;
  } catch (error) {
    throw new Error(
      `Failed to parse KEK from Doppler: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}
