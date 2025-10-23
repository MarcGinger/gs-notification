import { Module, Global } from '@nestjs/common';
import { loggerFactoryProvider } from './logging.providers';
import { LOGGER_FACTORY } from './logger.tokens';
import { SERVICE_LOGGING_METADATA } from './logger.constants';

/**
 * Global Logger Factory Module
 *
 * This module provides the centralized logger factory that can be used
 * by other modules to create module-scoped loggers with automatic metadata.
 */
@Global()
@Module({
  providers: [
    loggerFactoryProvider(
      SERVICE_LOGGING_METADATA.service,
      SERVICE_LOGGING_METADATA,
    ),
  ],
  exports: [LOGGER_FACTORY],
})
export class LoggerFactoryModule {}
