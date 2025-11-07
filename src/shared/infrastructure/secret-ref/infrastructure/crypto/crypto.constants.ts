/**
 * Cryptographic constants and configurations for Sealed SecretRef
 */

// Supported encryption algorithms
export const SUPPORTED_ALGORITHMS = {
  XCHACHA20_POLY1305: 'XCHACHA20-POLY1305',
  AES_256_GCM: 'AES-256-GCM',
} as const;

export type SupportedAlgorithm =
  (typeof SUPPORTED_ALGORITHMS)[keyof typeof SUPPORTED_ALGORITHMS];

// Key and nonce sizes (in bytes)
export const CRYPTO_SIZES = {
  // XChaCha20-Poly1305
  XCHACHA20_KEY_SIZE: 32,
  XCHACHA20_NONCE_SIZE: 24,
  XCHACHA20_TAG_SIZE: 16,

  // AES-256-GCM
  AES_256_KEY_SIZE: 32,
  AES_256_NONCE_SIZE: 12,
  AES_256_TAG_SIZE: 16,

  // KEK wrapping (AES-256-GCM for KEK operations)
  KEK_NONCE_SIZE: 12,
  KEK_TAG_SIZE: 16,
} as const;

// Envelope structure layout (in bytes)
export const ENVELOPE_LAYOUT = {
  // XChaCha20-Poly1305 envelope: nonce(24) + kekNonce(12) + wrappedDEK(32) + kekTag(16) + ciphertext(...) + tag(16)
  XCHACHA20_FIXED_OVERHEAD: 24 + 12 + 32 + 16 + 16, // 100 bytes

  // AES-256-GCM envelope: nonce(12) + kekNonce(12) + wrappedDEK(32) + kekTag(16) + ciphertext(...) + tag(16)
  AES_256_FIXED_OVERHEAD: 12 + 12 + 32 + 16 + 16, // 88 bytes
} as const;

// Error codes for crypto operations
export const CRYPTO_ERROR_CODES = {
  INVALID_ALGORITHM: 'INVALID_ALGORITHM',
  INVALID_KEY_SIZE: 'INVALID_KEY_SIZE',
  INVALID_NONCE_SIZE: 'INVALID_NONCE_SIZE',
  ENCRYPTION_FAILED: 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  INVALID_ENVELOPE: 'INVALID_ENVELOPE',
  KEK_WRAP_FAILED: 'KEK_WRAP_FAILED',
  KEK_UNWRAP_FAILED: 'KEK_UNWRAP_FAILED',
} as const;

export type CryptoErrorCode =
  (typeof CRYPTO_ERROR_CODES)[keyof typeof CRYPTO_ERROR_CODES];

// Default configuration
export const DEFAULT_CRYPTO_CONFIG = {
  algorithm: SUPPORTED_ALGORITHMS.XCHACHA20_POLY1305,
  envelopeVersion: 1,
} as const;
