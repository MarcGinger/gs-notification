import { AppConfigUtil } from './app-config.util';
import { validateProductionLoggingSafe } from '../logging/logging-validator';
import { createComponentLogger } from '../logging/logging.providers';
import { Log, Logger } from '../logging';
import { Result, ok, err, DomainError, withContext } from '../errors';
import { ConfigErrors } from './errors/config.errors';

/**
 * Enhanced configuration manager with modular service name support.
 *
 * Key improvements over ConfigService:
 * - Immutable config snapshot to prevent accidental mutations
 * - Production-only strict logging validation
 * - Initialize-once API with explicit base logger requirement
 * - Returns validation results for caller branching
 * - Integrates with modular service name configuration
 * - Comprehensive pass-through methods for centralized config access
 */
export class ConfigManager {
  private static instance: ConfigManager | undefined;
  private readonly config: Readonly<
    ReturnType<typeof AppConfigUtil.getLoggingConfig>
  >;
  private logger?: Logger;

  private constructor() {
    // Snapshot config once and freeze to avoid accidental mutation
    this.config = Object.freeze(AppConfigUtil.getLoggingConfig());
  }

  /**
   * Access the singleton instance. You can call this anywhere,
   * but remember to call `validateAndLog(baseLogger, serviceName?)` once on startup.
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /** Initialize component logger only once with optional service name */
  private initializeLogger(baseLogger: Logger): void {
    if (!this.logger) {
      // Always use createComponentLogger (serviceName is already in baseLogger ECS structure)
      this.logger = createComponentLogger(baseLogger, 'ConfigManager');
    }
  }

  /**
   * Validate config and log summary safely with Result pattern
   */
  validateAndLogSafe(baseLogger: Logger): Result<
    {
      valid: boolean;
      errors: string[];
      warnings: string[];
    },
    DomainError
  > {
    this.initializeLogger(baseLogger);

    const validation = AppConfigUtil.validateLoggingConfig();

    if (!validation.valid) {
      Log.error(this.logger!, 'Configuration validation failed', {
        method: 'validateAndLogSafe',
        configErrors: validation.errors,
        configWarnings: validation.warnings,
        error: 'Configuration validation failed',
      });

      return err(
        withContext(ConfigErrors.VALIDATION_FAILED, {
          source: 'logging',
          errors: validation.errors,
          warnings: validation.warnings,
          errorCount: validation.errors.length,
        }),
      );
    }

    if (validation.warnings.length > 0) {
      Log.warn(this.logger!, 'Configuration warnings detected', {
        method: 'validateAndLogSafe',
        configWarnings: validation.warnings,
      });
    }

    // Only enforce production logging rules in production
    if (AppConfigUtil.isProduction()) {
      const productionValidationResult = validateProductionLoggingSafe(
        this.logger!,
      );
      if (!productionValidationResult.ok) {
        Log.error(this.logger!, 'Production logging validation failed', {
          method: 'validateAndLogSafe',
          error: productionValidationResult.error.detail,
          errorCode: productionValidationResult.error.code,
        });

        return err(
          withContext(ConfigErrors.VALIDATION_FAILED, {
            source: 'production-logging',
            errors: [productionValidationResult.error.detail],
            warnings: validation.warnings,
            errorCount: 1,
          }),
        );
      }
    }

    Log.info(this.logger!, 'Configuration validated and loaded successfully', {
      method: 'validateAndLogSafe',
      environment: AppConfigUtil.getEnvironment(),
      containerized: AppConfigUtil.isContainerized(),
      logConfig: {
        level: this.config.level,
        sink: this.config.sink,
        pretty: this.config.pretty,
      },
    });

    return ok(validation);
  }

  /** Accessors (centralize all config reads here) */
  getLoggingConfig() {
    return this.config;
  }

  getEnvironment() {
    return AppConfigUtil.getEnvironment();
  }

  isProduction() {
    return AppConfigUtil.isProduction();
  }

  isContainerized() {
    return AppConfigUtil.isContainerized();
  }

  getDatabaseConfig() {
    return AppConfigUtil.getDatabaseConfig();
  }

  /** Security Configuration */
  getSecurityConfig() {
    return AppConfigUtil.getSecurityConfig();
  }

  /** Error Configuration */
  getErrorConfig() {
    return AppConfigUtil.getErrorConfig();
  }

  validateSecurityConfig(): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const validation = AppConfigUtil.validateSecurityConfig();

    if (this.logger) {
      if (!validation.valid) {
        Log.error(this.logger, 'Security configuration validation failed', {
          method: 'validateSecurityConfig',
          securityErrors: validation.errors,
          securityWarnings: validation.warnings,
        });
      } else if (validation.warnings.length > 0) {
        Log.warn(this.logger, 'Security configuration warnings detected', {
          method: 'validateSecurityConfig',
          securityWarnings: validation.warnings,
        });
      } else {
        Log.info(this.logger, 'Security configuration validated successfully', {
          method: 'validateSecurityConfig',
          environment: this.getEnvironment(),
        });
      }
    }

    return validation;
  }

  /**
   * Generic environment variable getter with optional default
   * Centralizes all env var access through ConfigManager
   */
  get(key: string, defaultValue?: string): string | undefined {
    const value = process.env[key];
    return value ?? defaultValue;
  }

  buildUrl(port?: number, path?: string) {
    return AppConfigUtil.buildUrl(port, path);
  }

  getServerConfigurations(port?: number) {
    return AppConfigUtil.getServerConfigurations(port);
  }

  getLogLevel() {
    return this.config.level || 'info';
  }

  /** Convenience logging helpers (no-ops if not initialized) */
  logInfo(message: string, context: Record<string, any> = {}) {
    if (this.logger) {
      Log.info(this.logger, message, { method: 'logInfo', ...context });
    }
  }

  logWarning(message: string, context: Record<string, any> = {}) {
    if (this.logger) {
      Log.warn(this.logger, message, {
        method: 'logWarning',
        ...context,
      });
    }
  }

  logError(error: Error, message: string, context: Record<string, any> = {}) {
    if (this.logger) {
      Log.error(this.logger, message, {
        method: 'logError',
        error: error.message,
        stack: error.stack,
        ...context,
      });
    }
  }

  /** Advanced configuration queries */

  /**
   * Check if the current environment supports a specific feature
   */
  supportsFeature(
    feature: 'hot-reload' | 'debug-mode' | 'performance-monitoring',
  ): boolean {
    const env = this.getEnvironment();
    switch (feature) {
      case 'hot-reload':
        return env === 'development';
      case 'debug-mode':
        return env !== 'production';
      case 'performance-monitoring':
        return env === 'production' || env === 'staging';
      default:
        return false;
    }
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary() {
    return {
      environment: this.getEnvironment(),
      isProduction: this.isProduction(),
      isContainerized: this.isContainerized(),
      logging: {
        level: this.config.level,
        sink: this.config.sink,
        pretty: this.config.pretty,
      },
      features: {
        hotReload: this.supportsFeature('hot-reload'),
        debugMode: this.supportsFeature('debug-mode'),
        performanceMonitoring: this.supportsFeature('performance-monitoring'),
      },
    };
  }

  /**
   * Validate specific configuration aspect without full bootstrap
   */
  validateAspect(
    aspect: 'logging' | 'database' | 'server' | 'security' | 'error',
  ): {
    valid: boolean;
    errors: string[];
  } {
    switch (aspect) {
      case 'logging':
        return AppConfigUtil.validateLoggingConfig();
      case 'security': {
        const securityValidation = AppConfigUtil.validateSecurityConfig();
        return {
          valid: securityValidation.valid,
          errors: securityValidation.errors,
        };
      }
      case 'error':
        try {
          const errorConfig = this.getErrorConfig();
          const errors: string[] = [];

          // Validate base URL
          if (!errorConfig.baseUrl) {
            errors.push('Error base URL is not configured');
          } else {
            try {
              new URL(errorConfig.baseUrl);
            } catch {
              errors.push('Error base URL is not a valid URL');
            }
          }

          // Validate version
          if (!errorConfig.version || !errorConfig.version.match(/^v\d+$/)) {
            errors.push(
              'Error API version should follow format "v1", "v2", etc.',
            );
          }

          return { valid: errors.length === 0, errors };
        } catch (error) {
          return { valid: false, errors: [(error as Error).message] };
        }
      case 'database':
        try {
          const dbConfig = this.getDatabaseConfig();
          const errors: string[] = [];

          // Validate connection settings
          const hasUrl = !!(dbConfig.url && dbConfig.url.trim());
          const hasExplicitHost = !!(dbConfig.host && dbConfig.host.trim());

          if (!hasUrl && !hasExplicitHost) {
            errors.push('Database connection URL or host must be configured');
          }

          if (
            !dbConfig.url &&
            (!dbConfig.port || dbConfig.port <= 0 || dbConfig.port > 65535)
          ) {
            errors.push('Database port must be between 1 and 65535');
          }

          if (!dbConfig.database) {
            errors.push('Database name must be configured');
          }

          // Schema is optional in module monolith architecture
          // When undefined, TypeORM uses the default schema (usually 'public')

          // Validate timeout settings
          if (dbConfig.maxQueryExecutionTime < 100) {
            errors.push('maxQueryExecutionTime should be at least 100ms');
          }

          if (dbConfig.statementTimeout < 1000) {
            errors.push('statementTimeout should be at least 1000ms');
          }

          if (dbConfig.connectTimeoutMS < 1000) {
            errors.push('connectTimeoutMS should be at least 1000ms');
          }

          // Validate pool settings
          if (dbConfig.pool.max < 1) {
            errors.push('Connection pool max must be at least 1');
          }

          if (dbConfig.pool.min < 0 || dbConfig.pool.min > dbConfig.pool.max) {
            errors.push('Connection pool min must be between 0 and max');
          }

          return { valid: errors.length === 0, errors };
        } catch (error) {
          return { valid: false, errors: [(error as Error).message] };
        }
      case 'server':
        try {
          const serverConfigs = this.getServerConfigurations();
          return {
            valid: serverConfigs.length > 0,
            errors:
              serverConfigs.length > 0
                ? []
                : ['Server configurations not available'],
          };
        } catch (error) {
          return { valid: false, errors: [(error as Error).message] };
        }
      default:
        // This should never happen with proper typing, but just in case
        return { valid: false, errors: ['Unknown aspect'] };
    }
  }
}
