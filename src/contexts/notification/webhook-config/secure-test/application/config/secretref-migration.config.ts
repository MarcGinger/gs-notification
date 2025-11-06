/**
 * SecretRef Migration Configuration and Feature Flags
 *
 * This file contains configuration management for the gradual rollout
 * of SecretRef functionality across different tenants and environments.
 */

import { AppConfigUtil } from 'src/shared/config/app-config.util';

/**
 * Configuration interface for SecretRef migration rollout
 */
export interface SecretRefMigrationConfig {
  /** Master toggle for SecretRef functionality */
  enabled: boolean;

  /** List of tenant IDs that should always use SecretRef */
  whitelistedTenants: string[];

  /** Percentage of tenants to include in gradual rollout (0-100) */
  rolloutPercentage: number;

  /** Whether to fallback to legacy implementation on SecretRef failure */
  fallbackToLegacy: boolean;

  /** Environment-specific overrides */
  environmentOverrides: {
    development: Partial<SecretRefMigrationConfig>;
    test: Partial<SecretRefMigrationConfig>;
    staging: Partial<SecretRefMigrationConfig>;
    production: Partial<SecretRefMigrationConfig>;
  };
}

/**
 * Default configuration values based on environment
 */
const DEFAULT_CONFIG: SecretRefMigrationConfig = {
  enabled: false,
  whitelistedTenants: [],
  rolloutPercentage: 0,
  fallbackToLegacy: true,
  environmentOverrides: {
    development: {
      enabled: true,
      fallbackToLegacy: false,
      rolloutPercentage: 100,
    },
    test: {
      enabled: true,
      fallbackToLegacy: false,
      rolloutPercentage: 100,
    },
    staging: {
      enabled: true,
      fallbackToLegacy: true,
      rolloutPercentage: 50,
    },
    production: {
      enabled: false,
      fallbackToLegacy: true,
      rolloutPercentage: 0,
    },
  },
};

/**
 * Get SecretRef migration configuration from environment variables
 * with intelligent defaults based on current environment.
 */
export function getSecretRefMigrationConfig(): SecretRefMigrationConfig {
  const environment = AppConfigUtil.getEnvironment();
  const envDefaults = DEFAULT_CONFIG.environmentOverrides[environment];

  // Base configuration from environment variables
  const baseConfig: SecretRefMigrationConfig = {
    enabled:
      process.env.SECRETREF_MIGRATION_ENABLED === 'true' ||
      envDefaults.enabled === true,

    whitelistedTenants: (process.env.SECRETREF_MIGRATION_TENANTS || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),

    rolloutPercentage: parseInt(
      process.env.SECRETREF_MIGRATION_ROLLOUT ||
        String(envDefaults.rolloutPercentage || 0),
      10,
    ),

    fallbackToLegacy:
      process.env.SECRETREF_MIGRATION_FALLBACK !== 'false' &&
      envDefaults.fallbackToLegacy !== false,

    environmentOverrides: DEFAULT_CONFIG.environmentOverrides,
  };

  // Apply environment-specific overrides
  return {
    ...baseConfig,
    ...envDefaults,
  };
}

/**
 * Validate SecretRef migration configuration
 */
export function validateSecretRefMigrationConfig(
  config: SecretRefMigrationConfig,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate rollout percentage
  if (config.rolloutPercentage < 0 || config.rolloutPercentage > 100) {
    errors.push('rolloutPercentage must be between 0 and 100');
  }

  // Production safety checks
  if (AppConfigUtil.isProduction()) {
    if (
      config.enabled &&
      config.rolloutPercentage > 50 &&
      !config.fallbackToLegacy
    ) {
      warnings.push(
        'High rollout percentage without fallback in production may be risky',
      );
    }

    if (
      config.enabled &&
      config.whitelistedTenants.length === 0 &&
      config.rolloutPercentage === 0
    ) {
      warnings.push(
        'SecretRef enabled but no tenants will use it (no whitelist or rollout percentage)',
      );
    }
  }

  // Development environment warnings
  if (AppConfigUtil.isDevelopment()) {
    if (!config.enabled) {
      warnings.push(
        'SecretRef disabled in development - consider enabling for testing',
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Environment variable documentation for SecretRef migration
 */
export const SECRETREF_MIGRATION_ENV_DOCS = {
  SECRETREF_MIGRATION_ENABLED: {
    description: 'Master toggle for SecretRef functionality',
    type: 'boolean',
    defaultValue: 'false (true in dev/test)',
    example: 'true',
  },
  SECRETREF_MIGRATION_TENANTS: {
    description: 'Comma-separated list of tenant IDs to always use SecretRef',
    type: 'string',
    defaultValue: 'empty',
    example: 'tenant-1,tenant-2,test-tenant',
  },
  SECRETREF_MIGRATION_ROLLOUT: {
    description: 'Percentage of tenants to include in gradual rollout',
    type: 'number',
    defaultValue: '0 (100 in dev/test, 50 in staging)',
    example: '25',
  },
  SECRETREF_MIGRATION_FALLBACK: {
    description: 'Whether to fallback to legacy on SecretRef failure',
    type: 'boolean',
    defaultValue: 'true (false in dev/test)',
    example: 'false',
  },
} as const;

/**
 * Get environment configuration summary for debugging
 */
export function getSecretRefConfigSummary(): {
  config: SecretRefMigrationConfig;
  validation: ReturnType<typeof validateSecretRefMigrationConfig>;
  environment: string;
  environmentVariables: Record<string, string | undefined>;
} {
  const config = getSecretRefMigrationConfig();
  const validation = validateSecretRefMigrationConfig(config);

  return {
    config,
    validation,
    environment: AppConfigUtil.getEnvironment(),
    environmentVariables: {
      SECRETREF_MIGRATION_ENABLED: process.env.SECRETREF_MIGRATION_ENABLED,
      SECRETREF_MIGRATION_TENANTS: process.env.SECRETREF_MIGRATION_TENANTS,
      SECRETREF_MIGRATION_ROLLOUT: process.env.SECRETREF_MIGRATION_ROLLOUT,
      SECRETREF_MIGRATION_FALLBACK: process.env.SECRETREF_MIGRATION_FALLBACK,
    },
  };
}
