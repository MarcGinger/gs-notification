/**
 * Doppler Configuration Service
 *
 * Bootstrap-time configuration loading with intentional fail-fast behavior:
 * - Uses structured logging for configuration operations
 * - Intentional throws for critical bootstrap failures (strict mode, missing secrets)
 * - Application cannot start with invalid configuration in production
 * - Different from business logic - this is infrastructure-level configuration
 */

import { Injectable, Inject } from '@nestjs/common';
import {
  ConfigLoader,
  ConfigLoadOptions,
  ConfigLoadResult,
} from '../config-loader';
import { AppConfig } from '../app-config.schema';
import { APP_LOGGER, Log, Logger } from '../../logging'; // ✅ Use barrel export

export interface DopplerServiceOptions {
  project?: string;
  config?: string;
  enableFallback?: boolean;
  enableLogging?: boolean;
  strict?: boolean;
}

@Injectable()
export class DopplerConfigService {
  private readonly configLoader: ConfigLoader;
  private cachedConfig: AppConfig | null = null;
  private loadAttempted = false;

  constructor(
    private readonly options: DopplerServiceOptions = {},
    @Inject(APP_LOGGER) private readonly logger?: Logger,
  ) {
    this.configLoader = ConfigLoader.getInstance();
  }

  async loadConfiguration(): Promise<AppConfig> {
    if (this.cachedConfig && this.loadAttempted) return this.cachedConfig;
    this.loadAttempted = true;

    const loadOptions: ConfigLoadOptions = {
      source: 'auto',
      dopplerProject: this.options.project || 'gs-scaffold-api',
      dopplerConfig: this.options.config || 'dev_main',
      strict: this.options.strict || false,
    };

    if (this.options.enableLogging && this.logger) {
      Log.info(this.logger, 'config.load.start', {
        service: 'shared',
        component: 'DopplerConfigService',
        method: 'loadConfiguration',
      });
    }

    try {
      const result: ConfigLoadResult =
        await this.configLoader.loadConfig(loadOptions);

      if (this.options.enableLogging && this.logger) {
        Log.info(this.logger, 'config.load.source', {
          service: 'shared',
          component: 'DopplerConfigService',
          method: 'loadConfiguration',
          source: result.source,
          dopplerAvailable: result.dopplerAvailable,
        });

        if (result.warnings.length > 0) {
          Log.warn(this.logger, 'config.load.warnings', {
            service: 'shared',
            component: 'DopplerConfigService',
            method: 'loadConfiguration',
            warnings: result.warnings.length,
          });
          for (const warning of result.warnings) {
            Log.warn(this.logger, 'config.load.warning_item', {
              service: 'shared',
              component: 'DopplerConfigService',
              method: 'loadConfiguration',
              warning,
            });
          }
        }
      }

      if (result.errors.length > 0) {
        const errorMessage = `Configuration validation failed:\n${result.errors.join('\n')}`;
        if (this.options.strict && this.logger) {
          Log.error(this.logger, 'config.load.error', {
            service: 'shared',
            component: 'DopplerConfigService',
            method: 'loadConfiguration',
            errorMessage,
          });
          // INTENTIONAL THROW: Strict mode configuration validation failure - application cannot start with invalid config
          throw new Error(errorMessage);
        }

        if (this.logger) {
          Log.warn(this.logger, 'config.load.validation_warning', {
            service: 'shared',
            component: 'DopplerConfigService',
            method: 'loadConfiguration',
            errorMessage,
          });
        }
      }

      this.validateCriticalSecrets(result.config);
      this.cachedConfig = result.config;

      if (this.options.enableLogging && this.logger) {
        Log.info(this.logger, 'config.load.success', {
          service: 'shared',
          component: 'DopplerConfigService',
          method: 'loadConfiguration',
          environment: result.config.APP_RUNTIME_ENVIRONMENT,
          application: result.config.APP_CORE_NAME || 'gs-scaffold',
        });
      }

      return result.config;
    } catch (error) {
      if (this.logger) {
        const e = error as Error;
        Log.error(this.logger, 'config.load.failure', {
          service: 'shared',
          component: 'DopplerConfigService',
          method: 'loadConfiguration',
          error: e.message,
          stack: e.stack,
        });
      }

      if (!this.options.enableFallback) throw error;

      if (this.logger)
        Log.warn(this.logger, 'config.load.fallback', {
          service: 'shared',
          component: 'DopplerConfigService',
          method: 'loadConfiguration',
        });

      try {
        const fallbackResult = await this.configLoader.loadConfig({
          ...loadOptions,
          source: 'env',
        });

        if (fallbackResult.errors.length > 0 && this.options.strict) {
          // INTENTIONAL THROW: Strict mode fallback configuration failure - application cannot start without valid config
          throw new Error(
            `Fallback configuration failed: ${fallbackResult.errors.join(', ')}`,
          );
        }

        this.cachedConfig = fallbackResult.config;
        if (this.logger)
          Log.warn(this.logger, 'config.load.fallback_used', {
            service: 'shared',
            component: 'DopplerConfigService',
            method: 'loadConfiguration',
          });

        return fallbackResult.config;
      } catch (fallbackError) {
        if (this.logger) {
          const fe = fallbackError as Error;
          Log.error(this.logger, 'config.load.fallback_failed', {
            service: 'shared',
            component: 'DopplerConfigService',
            method: 'loadConfiguration',
            error: fe.message,
            stack: fe.stack,
          });
        }
        // INTENTIONAL THROW: Critical infrastructure failure - both primary and fallback configuration loading failed
        throw new Error(
          `Configuration loading failed: ${(error as Error).message}. Fallback also failed: ${(fallbackError as Error).message}`,
        );
      }
    }
  }

  private validateCriticalSecrets(config: AppConfig): void {
    const criticalSecrets = [
      'AUTH_KEYCLOAK_CLIENT_SECRET',
      'SECURITY_PII_ENCRYPTION_KEY',
      'DATABASE_POSTGRES_PASSWORD',
    ];

    const missing = criticalSecrets.filter((secret) => !config[secret]);

    if (missing.length > 0) {
      const message = `Critical secrets missing: ${missing.join(', ')}`;
      if (config.APP_RUNTIME_ENVIRONMENT === 'production') {
        // INTENTIONAL THROW: Production security requirement - application cannot start without critical secrets
        throw new Error(`Production deployment blocked: ${message}`);
      }

      if (this.logger) {
        Log.warn(this.logger, 'config.validation.missing_secrets', {
          service: 'shared',
          component: 'DopplerConfigService',
          method: 'validateCriticalSecrets',
          missing,
        });
      }
    } else if (this.options.enableLogging && this.logger) {
      Log.info(this.logger, 'config.validation.passed', {
        service: 'shared',
        component: 'DopplerConfigService',
        method: 'validateCriticalSecrets',
      });
    }
  }

  async getConfigValue<K extends keyof AppConfig>(
    key: K,
  ): Promise<AppConfig[K]> {
    const config = await this.loadConfiguration();
    return config[key];
  }

  async isDopplerAvailable(): Promise<boolean> {
    try {
      return await this.configLoader.isDopplerAvailable();
    } catch {
      return false;
    }
  }

  async getConfigurationStatus(): Promise<{
    dopplerAvailable: boolean;
    configLoaded: boolean;
    source: string;
    environment: string;
    criticalSecretsCount: number;
    errors: string[];
    warnings: string[];
  }> {
    try {
      const result = await this.configLoader.loadConfig({
        dopplerProject: this.options.project || 'gs-scaffold-api',
        dopplerConfig: this.options.config || 'dev_main',
      });

      const criticalSecrets = [
        'AUTH_KEYCLOAK_CLIENT_SECRET',
        'SECURITY_PII_ENCRYPTION_KEY',
        'DATABASE_POSTGRES_PASSWORD',
        'DATABASE_POSTGRES_URL',
      ];

      const criticalSecretsCount = criticalSecrets.filter(
        (secret) => result.config[secret],
      ).length;

      return {
        dopplerAvailable: result.dopplerAvailable,
        configLoaded: true,
        source: result.source,
        environment: result.config.APP_RUNTIME_ENVIRONMENT || 'unknown',
        criticalSecretsCount,
        errors: result.errors,
        warnings: result.warnings,
      };
    } catch (error) {
      return {
        dopplerAvailable: false,
        configLoaded: false,
        source: 'error',
        environment: 'unknown',
        criticalSecretsCount: 0,
        errors: [(error as Error).message || 'Unknown configuration error'],
        warnings: [],
      };
    }
  }

  async reloadConfiguration(): Promise<AppConfig> {
    this.configLoader.clearCache();
    this.cachedConfig = null;
    this.loadAttempted = false;
    return this.loadConfiguration();
  }
}

export function createDopplerConfigService(
  options: DopplerServiceOptions = {},
): DopplerConfigService {
  return new DopplerConfigService({
    enableFallback: true,
    enableLogging: true,
    strict: false,
    ...options,
  });
}

export async function loadDopplerConfig(
  options: DopplerServiceOptions = {},
): Promise<AppConfig> {
  const service = createDopplerConfigService(options);
  return service.loadConfiguration();
}
