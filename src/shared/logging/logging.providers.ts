import pino, { Logger } from 'pino';
import { ClsService } from 'nestjs-cls';
import { AppConfigUtil } from '../config/app-config.util';
import buildPinoTransport from './transport.util';
import { FactoryProvider, ValueProvider } from '@nestjs/common';
import {
  createServiceLoggerFactory as createEnhancedServiceLoggerFactory,
  ServiceLoggerFactory,
} from './enhanced-logger.factory';
import { LOGGER_FACTORY, APP_LOGGER } from './logger.tokens'; // ✅ Import symbol token

// ✅ REMOVED: Conflicting string token export
// export const APP_LOGGER = 'APP_LOGGER'; // DELETED - conflicts with symbol token

/**
 * Creates a CLS-aware logger provider that automatically enriches logs with:
 * - Base metadata (app, environment, version, service)
 * - CLS context (traceId, correlationId, tenant, userId)
 *
 * This means services only need to pass method-specific context.
 */
/**
 * Enhanced app logger provider with configurable service name
 */
export const createAppLoggerProvider = (serviceName?: string) => ({
  provide: APP_LOGGER,
  inject: [ClsService],
  useFactory: (cls: ClsService): Logger => {
    const config = AppConfigUtil.getLoggingConfig();

    const transport = buildPinoTransport(
      config as unknown as ReturnType<typeof AppConfigUtil.getLoggingConfig>,
    ) as pino.TransportSingleOptions | undefined;

    // Use ServiceLoggerFactory with ECS structure and proper formatters
    const factory = createEnhancedServiceLoggerFactory(
      serviceName || config.appName,
      {
        environment: config.environment,
        version: config.appVersion,
        app: config.appName, // Keep app field for backward compatibility
      },
      {
        level: config.level,
        transport,
        mixin() {
          return {
            traceId: cls.get<string>('traceId'),
            correlationId: cls.get<string>('correlationId'),
            tenant: cls.get<string>('tenant'),
            userId: cls.get<string>('userId'),
          };
        },
        serializers: {
          err(err: Error) {
            return {
              type: err?.name,
              message: err?.message,
              stack: err?.stack,
            };
          },
        },
      },
    );

    return factory.getServiceLogger();
  },
});

// Keep the original for backward compatibility
export const appLoggerProvider = createAppLoggerProvider();

/**
 * Helper function to create component-specific loggers with configurable service name.
 * Returns a child logger that always includes the component name and service name.
 *
 * @param baseLogger - The base APP_LOGGER instance
 * @param component - Component name (usually class name)
 * @param serviceName - Optional service name override
 * @returns Child logger with component and service context
 */
export function createComponentLogger(
  baseLogger: Logger,
  component: string,
  serviceName?: string,
): Logger {
  const context: Record<string, any> = { component };

  // Add service name if provided (overrides any existing service in base logger)
  if (serviceName) {
    context.service = serviceName;
  }

  return baseLogger.child(context);
}

/**
 * Create a service-scoped logger factory for a specific module
 * This allows each module to have its own service name without hardcoding
 */
export function createServiceLoggerFactory(serviceName: string) {
  return {
    /**
     * Create a component logger for this service
     */
    createComponentLogger: (baseLogger: Logger, component: string) =>
      createComponentLogger(baseLogger, component, serviceName),

    /**
     * Create a service-specific app logger provider
     */
    createAppLoggerProvider: () => createAppLoggerProvider(serviceName),
  };
}

// ✨ NEW: Enhanced centralized logger factory providers

// App-level factory (created once in AppModule)
export const loggerFactoryProvider = (
  serviceName: string,
  base?: Record<string, unknown>,
): ValueProvider => ({
  provide: LOGGER_FACTORY,
  useValue: createEnhancedServiceLoggerFactory(serviceName, base),
});

/**
 * Module-scoped logger provider:
 * Binds APP_LOGGER to a child that already includes { service, boundedContext, application }.
 * Each bounded context module should register one of these.
 */
export const moduleLoggerProvider = (
  boundedContext: string,
  application: string,
): FactoryProvider => ({
  provide: APP_LOGGER,
  useFactory: (factory: ServiceLoggerFactory) =>
    factory.getLogger({ boundedContext, application }),
  inject: [LOGGER_FACTORY],
});
