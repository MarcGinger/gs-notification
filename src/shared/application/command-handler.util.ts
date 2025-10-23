import { DomainError } from '../errors';
import { Log, Logger } from '../logging';

/**
 * Base interface for commands that support audit logging
 */
export interface AuditableCommand {
  correlationId: string;
  timestamp: Date;
  user: {
    sub: string;
    tenant_id?: string;
  };
  [key: string]: any;
}

/**
 * Configuration for command execution logging
 */
export interface CommandLoggingConfig {
  /** Application name for logging context */
  application?: string;
  /** Component name for logging context */
  component?: string;
  /** Include sensitive data in logs (default: false) */
  includeSensitiveData?: boolean;
  /** Custom data extractor for the command */
  extractCommandData?: (command: any) => Record<string, any>;
  /** Custom error context provider */
  extractErrorContext?: (
    command: any,
    error: DomainError,
  ) => Record<string, any>;
}

/**
 * Shared utility for CQRS command handler error handling and logging
 */
export class CommandHandlerUtil {
  /**
   * Logs successful command execution with audit trail
   */
  static logCommandSuccess(
    logger: Logger,
    commandName: string,
    command: AuditableCommand,
    result: any,
    config: CommandLoggingConfig = {},
  ): void {
    const baseContext = this.buildBaseContext(command);
    const customData = config.extractCommandData?.(command) || {};

    Log.info(logger, `${commandName} executed successfully`, {
      application: config.application || 'unknown',
      component: config.component || 'CommandHandler',
      method: 'execute',
      ...baseContext,
      ...customData,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      resultId: result?.id?.value || result?.id,
    });
  }

  /**
   * Logs command execution start for audit trail
   */
  static logCommandStart(
    logger: Logger,
    commandName: string,
    command: AuditableCommand,
    config: CommandLoggingConfig = {},
  ): void {
    const baseContext = this.buildBaseContext(command);
    const customData = config.extractCommandData?.(command) || {};

    Log.info(logger, `Executing ${commandName}`, {
      application: config.application || 'unknown',
      component: config.component || 'CommandHandler',
      method: 'execute',
      ...baseContext,
      ...customData,
    });
  }

  /**
   * Enhanced validation error logging with categorization and context
   */
  static logValidationError(
    logger: Logger,
    commandName: string,
    error: DomainError,
    command: AuditableCommand,
    config: CommandLoggingConfig = {},
  ): void {
    const baseContext = {
      ...this.buildBaseContext(command),
      errorCode: error.code,
      errorCategory: error.category,
    };

    const customErrorContext =
      config.extractErrorContext?.(command, error) || {};

    // Categorize different types of validation errors for better debugging
    if (this.isApplicationValidationError(error)) {
      Log.warn(logger, `${commandName} - Application validation failed`, {
        application: config.application || 'unknown',
        component: config.component || 'CommandHandler',
        method: 'execute',
        ...baseContext,
        ...customErrorContext,
        errorType: 'TECHNICAL_VALIDATION',
        title: error.title,
        detail: error.detail,
        context: error.context,
      });
    } else if (this.isDomainValidationError(error)) {
      Log.warn(logger, `${commandName} - Domain validation failed`, {
        application: config.application || 'unknown',
        component: config.component || 'CommandHandler',
        method: 'execute',
        ...baseContext,
        ...customErrorContext,
        errorType: 'BUSINESS_VALIDATION',
        title: error.title,
        detail: error.detail,
        context: error.context,
      });
    } else if (this.isInfrastructureError(error)) {
      Log.error(logger, `${commandName} - Infrastructure error`, {
        application: config.application || 'unknown',
        component: config.component || 'CommandHandler',
        method: 'execute',
        ...baseContext,
        ...customErrorContext,
        errorType: 'INFRASTRUCTURE',
        title: error.title,
        detail: error.detail,
        retryable: error.retryable,
        context: error.context,
      });
    } else {
      // Generic error logging for unknown error types
      Log.error(logger, `${commandName} failed`, {
        application: config.application || 'unknown',
        component: config.component || 'CommandHandler',
        method: 'execute',
        ...baseContext,
        ...customErrorContext,
        errorType: 'UNKNOWN',
        title: error.title,
        detail: error.detail,
        context: error.context,
      });
    }
  }

  /**
   * Determines if error is application-layer validation (technical validation)
   */
  static isApplicationValidationError(error: DomainError): boolean {
    return (
      error.category === 'application' &&
      (error.code.includes('PROPS_STRUCTURE') ||
        error.code.includes('TECHNICAL_VALIDATION') ||
        error.code.includes('INPUT_FORMAT') ||
        error.code.includes('SCHEMA_VALIDATION'))
    );
  }

  /**
   * Determines if error is domain-layer validation (business rules)
   */
  static isDomainValidationError(error: DomainError): boolean {
    return (
      error.category === 'domain' ||
      error.code.startsWith('PRODUCT.') || // ProductErrors domain errors
      error.code.startsWith('ACCOUNT.') || // Account domain errors
      error.code.startsWith('USER.') || // User domain errors
      (error.category === 'validation' &&
        (error.code.includes('INVALID_VALUE') ||
          error.code.includes('BUSINESS_RULE') ||
          error.code.includes('INVARIANT') ||
          error.code.includes('PRODUCT.') ||
          error.code.includes('ACCOUNT.') ||
          error.code.includes('USER.')))
    );
  }

  /**
   * Determines if error is infrastructure-related
   */
  static isInfrastructureError(error: DomainError): boolean {
    return (
      error.category === 'infrastructure' ||
      error.code.includes('DATABASE') ||
      error.code.includes('NETWORK') ||
      error.code.includes('EXTERNAL_SERVICE') ||
      error.code.includes('TIMEOUT') ||
      error.code.includes('CONNECTION')
    );
  }

  /**
   * Builds base logging context from command
   */
  private static buildBaseContext(
    command: AuditableCommand,
  ): Record<string, any> {
    return {
      correlationId: command.correlationId,
      userId: command.user.sub,
      tenantId: command.user.tenant_id || 'unknown',
      timestamp: command.timestamp,
      executionTime: Date.now() - command.timestamp.getTime(),
    };
  }
}
