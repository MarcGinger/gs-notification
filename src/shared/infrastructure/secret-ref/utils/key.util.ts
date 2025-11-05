import { SecretRef } from '../secret-ref.types';

export function buildKey(ref: SecretRef) {
  // Cluster-safe, version-aware cache key (no plaintext)
  const ver = ref.version ?? 'latest';
  return `secretref:v1:${ref.provider}:${ref.tenant}:${ref.namespace}:${ref.key}:${ver}`;
}
