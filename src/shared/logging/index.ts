export * from './logging.module';
export * from './logger.config';
export * from './logger-factory.module';
export * from './logger.constants'; // Only logging infrastructure constants

// Enhanced logger factory exports
export {
  ServiceLoggerFactory,
  createServiceLoggerFactory as createEnhancedServiceLoggerFactory,
  Logger,
  ServiceLoggerFactoryOpts,
  GetLoggerArgs,
  GetBoundedContextLoggerArgs,
  GetApplicationLoggerArgs,
} from './enhanced-logger.factory';

// Logger tokens exports (use symbol tokens consistently)
export {
  LOGGER_FACTORY,
  BOUNDED_CONTEXT_LOGGER,
  APP_LOGGER, // ✅ Use symbol token directly, not string
} from './logger.tokens';

// Log utility exports (FIXED: Import Log from cls-logger.util to avoid conflicts)
export { componentLogger } from './log.util'; // ✅ Component logger only

// CLS-aware logging utilities (no ClsService injection required)
export { Log, setupGlobalClsLogging } from './cls-logger.util'; // ✅ ClsLog + backward compatible Log

// Enhanced providers exports (but NOT the conflicting APP_LOGGER string)
export {
  createAppLoggerProvider,
  createServiceLoggerFactory,
  loggerFactoryProvider,
  moduleLoggerProvider,
} from './logging.providers';
