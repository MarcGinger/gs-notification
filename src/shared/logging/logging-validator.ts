import { Logger } from 'pino';
import { AppConfigUtil } from '../config/app-config.util';
import { DomainError, Result, ok, err, withContext } from '../errors';

/**
 * Logging Validation Error Definitions
 * Defines all errors that can occur during logging configuration validation
 */
const LoggingValidatorErrorDefinitions = {
  PRODUCTION_VALIDATION_FAILED: {
    title: 'Production Logging Validation Failed',
    detail:
      'Critical logging configuration errors detected for production environment',
    category: 'validation' as const,
    retryable: false,
  },
} as const;

/**
 * Logging validation error catalog with namespaced error codes
 */
const LoggingValidatorErrors = Object.fromEntries(
  Object.entries(LoggingValidatorErrorDefinitions).map(([key, errorDef]) => {
    const code = `LOGGING_VALIDATOR.${key}` as const;
    return [key, { ...errorDef, code }];
  }),
) as {
  [K in keyof typeof LoggingValidatorErrorDefinitions]: DomainError<`LOGGING_VALIDATOR.${Extract<K, string>}`>;
};

/**
 * Validates production logging configuration safely
 * @param logger - Logger instance for recording validation results
 * @returns Result with void on success, DomainError on validation failure
 */
export function validateProductionLoggingSafe(
  logger: Logger,
): Result<void, DomainError> {
  const env = AppConfigUtil.getEnvironment();
  const config = AppConfigUtil.getLoggingConfig();

  const warnings: string[] = [];
  const errors: string[] = [];

  // Production environment checks
  if (env === 'production') {
    if (config.sink !== 'stdout') {
      warnings.push(
        `Production LOGGING_CORE_SINK is '${config.sink}', recommended: 'stdout' for better resilience`,
      );
    }

    if (config.pretty) {
      warnings.push(
        'LOGGING_CORE_PRETTY_ENABLED=true in production will impact performance, set to false',
      );
    }

    if (config.level === 'debug') {
      errors.push(
        'LOGGING_CORE_LEVEL=debug in production will generate excessive logs and impact performance',
      );
    }

    if (!config.appName || config.appName === 'gs-scaffold') {
      errors.push(
        'APP_CORE_NAME environment variable is required for production',
      );
    }

    if (!config.appVersion || config.appVersion === '1.0.0') {
      warnings.push(
        'APP_CORE_VERSION environment variable not set, using default value',
      );
    }
  }

  // Log validation results
  if (warnings.length > 0) {
    logger.warn(
      {
        service: 'gs-scaffold',
        component: 'LoggingValidator',
        method: 'validateProductionLoggingSafe',
        validationWarnings: warnings,
        environment: env,
      },
      'Logging configuration warnings detected',
    );
  }

  if (errors.length > 0) {
    logger.error(
      {
        service: 'gs-scaffold',
        component: 'LoggingValidator',
        method: 'validateProductionLoggingSafe',
        validationErrors: errors,
        environment: env,
      },
      'Critical logging configuration errors detected',
    );

    return err(
      withContext(LoggingValidatorErrors.PRODUCTION_VALIDATION_FAILED, {
        operation: 'validateProductionLoggingSafe',
        input: { env, config },
        validationErrors: errors,
        validationWarnings: warnings,
      }),
    );
  }

  // Success log
  logger.info(
    {
      service: 'gs-scaffold',
      component: 'LoggingValidator',
      method: 'validateProductionLoggingSafe',
      config: {
        sink: config.sink,
        level: config.level,
        pretty: config.pretty,
        environment: env,
      },
    },
    'Logging configuration validated successfully',
  );

  return ok(undefined);
}

/**
 * Validates that required CLS context is available
 */
export function validateClsContext(
  logger: Logger,
  expectedFields: string[] = ['traceId'],
): void {
  const missingFields: string[] = [];

  // This would be called within a CLS context
  // Implementation depends on your CLS service injection pattern
  expectedFields.forEach(() => {
    // This is a placeholder - you'd inject ClsService to check actual values
    // if (!cls.get(field)) missingFields.push(field);
  });

  if (missingFields.length > 0) {
    logger.warn(
      {
        service: 'gs-scaffold',
        component: 'LoggingValidator',
        method: 'validateClsContext',
        missingFields,
      },
      'CLS context validation failed - some required fields are missing',
    );
  }
}
