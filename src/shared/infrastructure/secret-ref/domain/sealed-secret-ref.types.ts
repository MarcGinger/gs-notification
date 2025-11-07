/**
 * Doppler SecretRef (existing provider)
 * Uses the current global shared key model
 */
export interface DopplerSecretRef {
  scheme: 'secret';
  provider: 'doppler';
  tenant: string;
  namespace: string;
  key: string;
  version?: string;
  algHint?: string;
  checksum?: string;
  raw?: string;
}

/**
 * Sealed SecretRef (new provider)
 * Uses envelope encryption with tenant-scoped KEKs
 */
export interface SealedSecretRef {
  scheme: 'secret';
  provider: 'sealed';
  tenant: string;
  kekKid: string; // KEK identifier in Doppler (e.g., 'TENANT_KEK_CORE_V1')
  alg: 'XCHACHA20-POLY1305' | 'AES-256-GCM';
  aad?: string; // Additional authenticated data for context binding
  blob: string; // Base64url-encoded envelope containing encrypted DEK and ciphertext
  v: number; // Envelope format version
}

/**
 * Union type supporting both providers
 */
export type SecretRefUnion = DopplerSecretRef | SealedSecretRef;

/**
 * Type guard to check if a SecretRef is a DopplerSecretRef
 */
export function isDopplerSecretRef(
  ref: SecretRefUnion,
): ref is DopplerSecretRef {
  return ref.provider === 'doppler';
}

/**
 * Type guard to check if a SecretRef is a SealedSecretRef
 */
export function isSealedSecretRef(ref: SecretRefUnion): ref is SealedSecretRef {
  return ref.provider === 'sealed';
}

/**
 * Validate that a SecretRef has the minimum required fields
 */
export function validateSecretRef(ref: unknown): ref is SecretRefUnion {
  if (!ref || typeof ref !== 'object') {
    return false;
  }

  const secretRef = ref as Record<string, unknown>;

  // Check common fields
  if (secretRef.scheme !== 'secret' || typeof secretRef.provider !== 'string') {
    return false;
  }

  // Provider-specific validation
  switch (secretRef.provider) {
    case 'doppler':
      return (
        typeof secretRef.tenant === 'string' &&
        typeof secretRef.namespace === 'string' &&
        typeof secretRef.key === 'string'
      );

    case 'sealed':
      return (
        typeof secretRef.tenant === 'string' &&
        typeof secretRef.kekKid === 'string' &&
        typeof secretRef.alg === 'string' &&
        typeof secretRef.blob === 'string' &&
        typeof secretRef.v === 'number'
      );

    default:
      return false;
  }
}

/**
 * Create a Doppler SecretRef (for backward compatibility)
 */
export function createDopplerSecretRef(
  tenant: string,
  namespace: string,
  key: string,
  options?: {
    version?: string;
    algHint?: string;
    checksum?: string;
  },
): DopplerSecretRef {
  return {
    scheme: 'secret',
    provider: 'doppler',
    tenant,
    namespace,
    key,
    version: options?.version,
    algHint: options?.algHint,
    checksum: options?.checksum,
    raw: `secret://doppler/${tenant}/${namespace}/${key}${options?.version ? `@${options.version}` : ''}`,
  };
}

/**
 * Create a Sealed SecretRef
 */
export function createSealedSecretRef(
  tenant: string,
  kekKid: string,
  alg: 'XCHACHA20-POLY1305' | 'AES-256-GCM',
  blob: string,
  options?: {
    aad?: string;
    v?: number;
  },
): SealedSecretRef {
  return {
    scheme: 'secret',
    provider: 'sealed',
    tenant,
    kekKid,
    alg,
    blob,
    aad: options?.aad,
    v: options?.v ?? 1,
  };
}
