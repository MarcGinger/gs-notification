/**
 * Centralized Environment Type Definition
 *
 * This file defines the canonical environment types used across the application.
 * All modules should use these types to ensure consistency.
 */

/**
 * Application Environment
 *
 * Standardized environment values used throughout the application.
 * Based on common Node.js conventions with explicit naming.
 */
export type Environment = 'development' | 'test' | 'staging' | 'production';

/**
 * Environment utility functions
 */
export class EnvironmentUtil {
  /**
   * Get the current environment from NODE_ENV with fallback
   */
  static getCurrent(): Environment {
    const env = (
      process.env.APP_RUNTIME_ENVIRONMENT ||
      process.env.NODE_ENV ||
      'development'
    ).toLowerCase();

    if (env === 'production') return 'production';
    if (env === 'staging') return 'staging';
    if (env === 'test') return 'test';
    return 'development';
  }

  /**
   * Check if current environment is production
   */
  static isProduction(): boolean {
    return this.getCurrent() === 'production';
  }

  /**
   * Check if current environment is development
   */
  static isDevelopment(): boolean {
    return this.getCurrent() === 'development';
  }

  /**
   * Check if current environment is staging
   */
  static isStaging(): boolean {
    return this.getCurrent() === 'staging';
  }

  /**
   * Check if current environment is test
   */
  static isTest(): boolean {
    return this.getCurrent() === 'test';
  }

  /**
   * Get environment display name
   */
  static getDisplayName(env?: Environment): string {
    const environment = env || this.getCurrent();
    switch (environment) {
      case 'development':
        return 'Development';
      case 'production':
        return 'Production';
      case 'staging':
        return 'Staging';
      case 'test':
        return 'Test';
      default:
        return 'Unknown';
    }
  }
}

/**
 * @deprecated Legacy environment mapping - to be removed after migration
 *
 * This is a temporary mapping for systems that still use abbreviated names.
 * All systems should migrate to use the standard Environment type.
 */
export const LEGACY_ENVIRONMENT_MAP = {
  development: 'dev',
  production: 'prod',
  test: 'test',
  staging: 'staging',
} as const;

export type LegacyEnvironment =
  (typeof LEGACY_ENVIRONMENT_MAP)[keyof typeof LEGACY_ENVIRONMENT_MAP];

/**
 * Convert standard environment to legacy format
 * @deprecated Use standard Environment type instead
 */
export function toLegacyEnvironment(env: Environment): LegacyEnvironment {
  return LEGACY_ENVIRONMENT_MAP[env];
}

/**
 * Convert legacy environment to standard format
 * @deprecated Use standard Environment type instead
 */
export function fromLegacyEnvironment(
  legacyEnv: LegacyEnvironment,
): Environment {
  switch (legacyEnv) {
    case 'dev':
      return 'development';
    case 'prod':
      return 'production';
    case 'test':
      return 'test';
    case 'staging':
      return 'staging';
    default:
      return 'development';
  }
}
