import { Logger } from './enhanced-logger.factory';
import { ClsService } from 'nestjs-cls';
import { CorrelationUtil } from '../utilities/correlation.util';

/**
 * Global CLS accessor for logging.
 * This allows loggers to access CLS context without requiring services to inject ClsService.
 */
class GlobalClsAccessor {
  private static instance: ClsService | null = null;

  static setClsService(cls: ClsService) {
    GlobalClsAccessor.instance = cls;
  }

  static getCls(): ClsService | null {
    return GlobalClsAccessor.instance;
  }
}

/**
 * CLS-aware logging utilities that automatically inject trace context.
 * No need for services to inject ClsService - it's accessed globally.
 */
export class Log {
  /**
   * Info logging with automatic CLS context injection
   */
  static info(
    logger: Logger,
    message: string,
    fields?: Record<string, unknown>,
  ) {
    const enhancedFields = Log.enhanceFields(fields);
    logger.info(enhancedFields, message);
  }

  /**
   * Warn logging with automatic CLS context injection
   */
  static warn(
    logger: Logger,
    message: string,
    fields?: Record<string, unknown>,
  ) {
    const enhancedFields = Log.enhanceFields(fields);
    logger.warn(enhancedFields, message);
  }

  /**
   * Error logging with automatic CLS context injection
   */
  static error(
    logger: Logger,
    message: string,
    fields?: Record<string, unknown>,
  ) {
    const enhancedFields = Log.enhanceFields(fields);
    logger.error(enhancedFields, message);
  }

  /**
   * Debug logging with automatic CLS context injection
   */
  static debug(
    logger: Logger,
    message: string,
    fields?: Record<string, unknown>,
  ) {
    const enhancedFields = Log.enhanceFields(fields);
    logger.debug(enhancedFields, message);
  }

  /**
   * Enhances log fields with automatic trace context from global CLS when available
   */
  private static enhanceFields(
    fields?: Record<string, unknown>,
  ): Record<string, unknown> {
    const baseFields = fields ?? {};

    const cls = GlobalClsAccessor.getCls();
    if (!cls) {
      return baseFields;
    }

    // Auto-inject trace context if available and not already provided
    const traceId = CorrelationUtil.getTraceId(cls);
    if (traceId && !baseFields.trace) {
      baseFields.trace = { id: traceId };
    }

    // Auto-inject correlation ID if available and not already provided
    const correlationId = CorrelationUtil.getCurrent(cls);
    if (correlationId && !baseFields.correlationId) {
      baseFields.correlationId = correlationId;
    }

    // Auto-inject user context if available and not already provided
    const userId = CorrelationUtil.getUserId(cls);
    if (userId && !baseFields.userId) {
      baseFields.userId = userId;
    }

    // Auto-inject tenant context if available and not already provided
    const tenantId = CorrelationUtil.getTenantId(cls);
    if (tenantId && !baseFields.tenantId) {
      baseFields.tenantId = tenantId;
    }

    return baseFields;
  }
}

/**
 * Global CLS setup utility
 * Call this once in your application bootstrap to enable automatic CLS access in logging
 */
export function setupGlobalClsLogging(cls: ClsService) {
  GlobalClsAccessor.setClsService(cls);
}

/**
 * Backwards compatible Log utility that still works as before
 * but services can optionally switch to ClsLog for automatic enhancement
 */
// export const Log = {
//   info: (logger: Logger, message: string, fields?: Record<string, unknown>) =>
//     logger.info(fields ?? {}, message),
//   warn: (logger: Logger, message: string, fields?: Record<string, unknown>) =>
//     logger.warn(fields ?? {}, message),
//   error: (logger: Logger, message: string, fields?: Record<string, unknown>) =>
//     logger.error(fields ?? {}, message),
//   debug: (logger: Logger, message: string, fields?: Record<string, unknown>) =>
//     logger.debug(fields ?? {}, message),
// };
