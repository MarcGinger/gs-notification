// ⚠️ PRODUCTION-READY: Centralized Configuration + Key Prefixes
// ✅ Configurable TTLs (no hardcoded values)
// ✅ Centralized key prefixes for schema consistency
// ✅ Environment-specific configuration support

export const ProjectorConfig = {
  // ✅ TTL Configuration (all configurable, no hardcoded timeouts)
  DEDUP_TTL_HOURS: 48,
  DELETE_TTL_SECONDS: 30 * 24 * 60 * 60, // 30 days
  VERSION_HINT_TTL_SECONDS: 7 * 24 * 60 * 60, // 7 days (null = no TTL)

  // ✅ Key Prefixes (centralized schema management)
  // NOTE: These are base prefixes - modules should provide their namespace
  DEDUPE_KEY_PREFIX: 'pd:dup:', // projector dedup
  VERSION_KEY_PREFIX: 'pp:ver:', // projector projected version

  // Pipeline Configuration
  DEFAULT_BATCH_SIZE: 100,
  DEFAULT_MAX_RETRIES: 3,
  DEFAULT_RETRY_DELAY_MS: 1000,
  DEFAULT_CHECKPOINT_BATCH_SIZE: 10,

  // Cache Configuration
  DEFAULT_CACHE_TTL_SECONDS: 24 * 60 * 60, // 24 hours
  MAX_CACHE_KEY_LENGTH: 250, // Redis key length limit

  // Health Check Configuration
  HEALTH_CHECK_INTERVAL_MS: 30 * 1000, // 30 seconds
  MAX_CONSECUTIVE_FAILURES: 5,

  // Event Processing Configuration
  MAX_EVENT_AGE_HOURS: 72, // Skip events older than 3 days
  POSITION_COMMIT_INTERVAL: 50, // Commit position every N events
} as const;

// ✅ Environment-specific overrides
export interface ProjectorConfigOverrides {
  // Module-specific configuration
  moduleNamespace?: string; // e.g., 'notification.slack', 'user.profile', etc.

  // TTL overrides
  dedupTtlHours?: number;
  deleteTtlSeconds?: number;
  versionHintTtlSeconds?: number | null;

  // Performance overrides
  batchSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

// ✅ Configuration builder with environment support
export class ProjectorConfigBuilder {
  static build(overrides?: ProjectorConfigOverrides) {
    const moduleNamespace = overrides?.moduleNamespace;

    // Build namespaced key prefixes if module namespace provided
    const dedupPrefix = moduleNamespace
      ? `${moduleNamespace}:${ProjectorConfig.DEDUPE_KEY_PREFIX}`
      : ProjectorConfig.DEDUPE_KEY_PREFIX;

    const versionPrefix = moduleNamespace
      ? `${moduleNamespace}:${ProjectorConfig.VERSION_KEY_PREFIX}`
      : ProjectorConfig.VERSION_KEY_PREFIX;

    return {
      ...ProjectorConfig,
      // Namespaced key prefixes
      DEDUPE_KEY_PREFIX: dedupPrefix,
      VERSION_KEY_PREFIX: versionPrefix,

      // TTL configurations
      DEDUP_TTL_HOURS:
        overrides?.dedupTtlHours ?? ProjectorConfig.DEDUP_TTL_HOURS,
      DELETE_TTL_SECONDS:
        overrides?.deleteTtlSeconds ?? ProjectorConfig.DELETE_TTL_SECONDS,
      VERSION_HINT_TTL_SECONDS:
        overrides?.versionHintTtlSeconds ??
        ProjectorConfig.VERSION_HINT_TTL_SECONDS,

      // Performance configurations
      DEFAULT_BATCH_SIZE:
        overrides?.batchSize ?? ProjectorConfig.DEFAULT_BATCH_SIZE,
      DEFAULT_MAX_RETRIES:
        overrides?.maxRetries ?? ProjectorConfig.DEFAULT_MAX_RETRIES,
      DEFAULT_RETRY_DELAY_MS:
        overrides?.retryDelayMs ?? ProjectorConfig.DEFAULT_RETRY_DELAY_MS,
    } as const;
  }

  // ✅ Validation helpers
  static validateConfig(config: typeof ProjectorConfig): void {
    if (config.DEDUP_TTL_HOURS <= 0) {
      throw new Error('DEDUP_TTL_HOURS must be positive');
    }

    if (config.DELETE_TTL_SECONDS <= 0) {
      throw new Error('DELETE_TTL_SECONDS must be positive');
    }

    if (
      config.VERSION_HINT_TTL_SECONDS !== null &&
      config.VERSION_HINT_TTL_SECONDS <= 0
    ) {
      throw new Error('VERSION_HINT_TTL_SECONDS must be positive or null');
    }

    if (config.DEFAULT_BATCH_SIZE <= 0) {
      throw new Error('DEFAULT_BATCH_SIZE must be positive');
    }
  }
}

// ✅ Type-safe configuration access
export type ProjectorConfigType = typeof ProjectorConfig;
