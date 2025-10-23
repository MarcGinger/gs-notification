import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

export type Logger = PinoLogger;

export interface ServiceLoggerFactoryOpts {
  service: string;
  base?: Record<string, unknown>; // e.g., { environment, version }
  pino?: LoggerOptions; // optional pino config overrides
}

export interface GetLoggerArgs {
  boundedContext: string;
  application: string;
  component?: string;
}

export interface GetBoundedContextLoggerArgs {
  boundedContext: string;
}

export interface GetApplicationLoggerArgs {
  application: string;
  component?: string;
}

export class ServiceLoggerFactory {
  private readonly baseLogger: Logger;
  private readonly serviceConfig: {
    name: string;
    environment?: unknown;
    version?: unknown;
    base: Record<string, unknown>;
  };

  constructor(opts: ServiceLoggerFactoryOpts) {
    const { service, base = {}, pino: pinoOpts } = opts;
    // Extract environment and version for service object, filter out others to avoid duplication
    const { environment, version, ...filteredBase } = base;

    // Store service info for child loggers to use
    this.serviceConfig = {
      name: service,
      base: Object.fromEntries(
        Object.entries(filteredBase).filter(
          ([key]) =>
            key !== 'service' &&
            key !== 'name' && // Avoid duplication with service.name
            key !== 'namespace', // Avoid duplication with service.namespace
        ),
      ),
      // Include environment and version in service object
      environment,
      version,
    };

    this.baseLogger = pino({
      // Remove name to avoid duplication with service.name
      ...pinoOpts,
      base: {}, // Empty base - service info will be added by children
      // Add @timestamp and level_label formatters for polish compatibility
      formatters: {
        level(label: string, number: number) {
          return { level: number, level_label: label };
        },
        // Keep bindings as-is
        bindings(bindings) {
          return bindings;
        },
        // Keep log object as-is
        log(object) {
          return object;
        },
        // Override with any custom formatters from pinoOpts
        ...pinoOpts?.formatters,
      },
      timestamp: () => {
        const now = new Date();
        return `,"@timestamp":"${now.toISOString()}","time":${now.getTime()}`;
      },
    });
  }

  /**
   * Returns a logger child pre-bound with boundedContext + application (+ optional component)
   */
  getLogger(args: GetLoggerArgs): Logger {
    const { boundedContext, application, component } = args;

    // Use stored service config instead of accessing bindings
    const {
      name: serviceName,
      environment,
      version,
      base: serviceBase,
    } = this.serviceConfig;

    // Create child logger with complete service object
    return this.baseLogger.child({
      service: {
        name: serviceName,
        ...(environment !== undefined ? { environment } : {}),
        ...(version !== undefined ? { version } : {}),
        ...serviceBase,
        namespace: boundedContext,
      },
      application,
      // Remove boundedContext to avoid duplication with service.namespace
      ...(component ? { component } : {}),
    });
  }

  /** Optionally expose the raw base logger (service-only) */
  getServiceLogger(): Logger {
    return this.baseLogger;
  }
}

/** Convenience creator (backward-compatible name) */
export function createServiceLoggerFactory(
  service: string,
  base?: Record<string, unknown>,
  pinoOpts?: LoggerOptions,
) {
  return new ServiceLoggerFactory({ service, base, pino: pinoOpts });
}
