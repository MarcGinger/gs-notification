// Main module and service exports
export { SecretRefModule } from './secret-ref.module';
export { SecretRefService } from './secret-ref.service';

// Types and interfaces
export * from './secret-ref.types';
import { SecretRef } from './secret-ref.types';

// Health and metrics
export { SecretRefHealthIndicator } from './health/secret-ref-health.indicator';
export { SecretRefMetricsService } from './metrics/secret-ref-metrics.service';

// Configuration
export { SecretRefConfigValidator } from './config/secret-ref-config.validator';

// Utilities (for advanced usage)
export { buildKey } from './utils/key.util';
export { maskKey } from './utils/mask.util';

// Helper functions for creating SecretRefs
export function parseSecretUri(uri: string): SecretRef {
  // Example: secret://doppler/core/notification/slack/bot-token?v=latest
  const u = new URL(uri);
  if (u.protocol !== 'secret:') throw new Error('Invalid scheme');

  const [provider, tenant, namespace, ...rest] = u.pathname
    .replace(/^\//, '')
    .split('/');

  return {
    scheme: 'secret',
    provider: provider as 'doppler',
    tenant,
    namespace,
    key: rest.join('/'),
    version: u.searchParams.get('v') ?? undefined,
    raw: uri,
  };
}

export function createSecretRef(
  provider: 'doppler',
  tenant: string,
  namespace: string,
  key: string,
  version?: string,
): SecretRef {
  return {
    scheme: 'secret',
    provider,
    tenant,
    namespace,
    key,
    version,
  };
}
