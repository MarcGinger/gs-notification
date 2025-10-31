// src/shared/utilities/correlation.util.ts

import { randomUUID } from 'crypto';
import { ClsService } from 'nestjs-cls';

/**
 * Correlation utility for managing request correlation IDs.
 * Ensures every infrastructure operation has proper tracing context.
 */
export class CorrelationUtil {
  /**
   * Ensures a correlation ID exists, generating one if missing.
   * Uses CLS (Continuation Local Storage) context when available.
   */
  static ensure(cls?: ClsService): string {
    if (cls) {
      const existing = cls.get<string>('correlationId');
      if (existing) return existing;

      const newId = CorrelationUtil.generate();
      cls.set('correlationId', newId);
      return newId;
    }

    return CorrelationUtil.generate();
  }

  /**
   * Generates a new correlation ID with consistent format.
   */
  static generate(): string {
    return `corr-${randomUUID()}`;
  }

  /**
   * Generates an operation-specific correlation ID with context.
   * Format: {operation}-{timestamp}-{shortId}
   *
   * @param operation - The operation being performed (e.g., 'product-create', 'user-update')
   * @returns A correlation ID with operation context
   */
  static generateForOperation(operation: string): string {
    const timestamp = Date.now();
    const shortId = randomUUID().substring(0, 8);
    return `${operation}-${timestamp}-${shortId}`;
  }

  /**
   * Generates a UUID-based operation correlation ID.
   * Format: {operation}-{uuid}
   *
   * @param operation - The operation being performed
   * @returns A correlation ID with full UUID
   */
  static generateOperationUUID(operation: string): string {
    return `${operation}-${randomUUID()}`;
  }

  /**
   * Gets the current correlation ID from CLS context.
   */
  static getCurrent(cls: ClsService): string | undefined {
    return cls.get<string>('correlationId');
  }

  /**
   * Gets the current trace ID from CLS context.
   */
  static getTraceId(cls: ClsService): string | undefined {
    return cls.get<string>('traceId');
  }

  /**
   * Gets the current tenant ID from CLS context.
   */
  static getTenantId(cls: ClsService): string | undefined {
    return cls.get<string>('tenant');
  }

  /**
   * Gets the current user ID from CLS context.
   */
  static getUserId(cls: ClsService): string | undefined {
    return cls.get<string>('userId');
  }
}
