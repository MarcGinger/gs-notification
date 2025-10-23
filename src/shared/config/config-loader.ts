/**
 * Configuration Loader with Doppler Support
 *
 * This module provides configuration loading with support for:
 * - Doppler secrets management
 * - Traditional environment variables (backward compatibility)
 * - Environment-specific validation
 * - Configuration schema validation
 */

import {
  AppConfigSchema,
  AppConfig,
  Environment,
  validateEnvironmentConfig,
} from './app-config.schema';
import * as dotenv from 'dotenv';
import {
  Result,
  ok,
  err,
  isOk,
  isErr,
  DomainError,
  withContext,
} from '../errors';
import { ConfigHelper } from './utils/config.helper';
import { ConfigErrors } from './errors/config.errors';

// Load .env file if it exists
dotenv.config();

export interface ConfigLoadOptions {
  /** Force loading from specific source */
  source?: 'doppler' | 'env' | 'auto';
  /** Environment to validate against */
  environment?: Environment;
  /** Enable strict validation (fail on warnings) */
  strict?: boolean;
  /** Doppler project name */
  dopplerProject?: string;
  /** Doppler config/environment name */
  dopplerConfig?: string;
}

export interface ConfigLoadResult {
  config: AppConfig;
  source: 'doppler' | 'env' | 'mixed';
  errors: string[];
  warnings: string[];
  dopplerAvailable: boolean;
}

/**
 * Configuration Loader Class
 */
export class ConfigLoader {
  private static instance: ConfigLoader;
  private cachedConfig: AppConfig | null = null;
  private dopplerAvailable: boolean | null = null;

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  /**
   * Check if Doppler CLI is available and configured
   */
  async isDopplerAvailable(): Promise<boolean> {
    if (this.dopplerAvailable !== null) {
      return this.dopplerAvailable;
    }

    const result = await ConfigHelper.checkDopplerAvailability();

    if (isOk(result)) {
      this.dopplerAvailable = result.value;
      return result.value;
    } else {
      this.dopplerAvailable = false;
      return false;
    }
  }

  /**
   * Load configuration from Doppler using CLI
   */
  async loadFromDoppler(
    options: ConfigLoadOptions = {},
  ): Promise<Result<Record<string, string>, DomainError>> {
    const project = options.dopplerProject || 'gs-scaffold-api';
    const config = options.dopplerConfig || 'dev_main';

    const context = {
      dopplerProject: project,
      dopplerConfig: config,
      source: 'doppler' as const,
    };

    return await ConfigHelper.loadFromDoppler(project, config, context);
  }

  /**
   * Load and validate configuration from available sources
   */
  async loadConfig(options: ConfigLoadOptions = {}): Promise<ConfigLoadResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let source: 'doppler' | 'env' | 'mixed' = 'env';
    let rawConfig: Record<string, string> = {};

    // Determine source strategy
    const dopplerAvailable = await this.isDopplerAvailable();
    const useSource = options.source || 'auto';

    if (useSource === 'doppler' || (useSource === 'auto' && dopplerAvailable)) {
      const dopplerResult = await this.loadFromDoppler(options);

      if (isOk(dopplerResult)) {
        rawConfig = dopplerResult.value;
        source = 'doppler';
      } else {
        const errorMessage = ConfigHelper.getErrorMessage(dopplerResult.error);
        warnings.push(`Failed to load from Doppler: ${errorMessage}`);

        if (useSource === 'doppler') {
          errors.push('Doppler loading failed and was explicitly requested');
        } else {
          // Fall back to environment variables
          const envResult = ConfigHelper.loadFromEnv({ source: 'env' });
          if (isOk(envResult)) {
            rawConfig = envResult.value;
            source = 'mixed';
            warnings.push('Falling back to environment variables');
          } else {
            errors.push(
              `Failed to load from environment: ${ConfigHelper.getErrorMessage(envResult.error)}`,
            );
          }
        }
      }
    } else {
      const envResult = ConfigHelper.loadFromEnv({ source: 'env' });
      if (isOk(envResult)) {
        rawConfig = envResult.value;
        source = 'env';
      } else {
        errors.push(
          `Failed to load from environment: ${ConfigHelper.getErrorMessage(envResult.error)}`,
        );
      }
    }

    // Apply legacy variable mapping
    const mappedConfig = rawConfig; // No legacy mapping needed - all secrets use proper Doppler names

    // Legacy warning removed - all variables use proper Doppler naming convention

    // Validate and parse configuration
    const validationResult = ConfigHelper.validateConfigSchema(
      mappedConfig,
      AppConfigSchema,
      { source },
    );

    if (isErr(validationResult)) {
      const validationErrors = (validationResult.error.context
        ?.validationErrors as string[]) || [
        ConfigHelper.getErrorMessage(validationResult.error),
      ];
      errors.push(...validationErrors);

      // Return partial config with errors
      return {
        config: {} as AppConfig,
        source,
        errors,
        warnings,
        dopplerAvailable,
      };
    }

    const config = validationResult.value;

    // Environment-specific validation
    const environment = options.environment || config.APP_RUNTIME_ENVIRONMENT;
    const validation = validateEnvironmentConfig(config, environment);

    errors.push(...validation.errors);
    warnings.push(...validation.warnings);

    // Cache successful configuration
    if (errors.length === 0) {
      this.cachedConfig = config;
    }

    return {
      config,
      source,
      errors,
      warnings,
      dopplerAvailable,
    };
  }

  /**
   * Get cached configuration (load if not cached) - Returns Result
   */
  async getConfigSafe(
    options: ConfigLoadOptions = {},
  ): Promise<Result<AppConfig, DomainError>> {
    if (this.cachedConfig && !options.source) {
      return ok(this.cachedConfig);
    }

    const result = await this.loadConfig(options);

    if (result.errors.length > 0) {
      return err(
        withContext(ConfigErrors.VALIDATION_FAILED, {
          source: result.source,
          errors: result.errors,
          warnings: result.warnings,
          dopplerAvailable: result.dopplerAvailable,
          errorCount: result.errors.length,
        }),
      );
    }

    return ok(result.config);
  }

  /**
   * Clear cached configuration (useful for testing)
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.dopplerAvailable = null;
  }
}

/**
 * Convenience function to load configuration
 */
export async function loadConfig(
  options: ConfigLoadOptions = {},
): Promise<ConfigLoadResult> {
  const loader = ConfigLoader.getInstance();
  return loader.loadConfig(options);
}

/**
 * Convenience function to get validated configuration safely with Result pattern
 */
export async function getConfigSafe(
  options: ConfigLoadOptions = {},
): Promise<Result<AppConfig, DomainError>> {
  const loader = ConfigLoader.getInstance();
  return loader.getConfigSafe(options);
}
