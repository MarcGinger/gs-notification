/**
 * Application Port for MessageRequest outcome reporting
 *
 * Allows the executor (worker) to report delivery outcomes back to the
 * MessageRequest bounded context via clean application layer interfaces.
 */
export interface IMessageRequestAppPort {
  /**
   * Record successful message delivery
   */
  recordSent(input: {
    id: string; // messageRequestId
    tenant: string;
    slackTs: string;
    slackChannel: string;
    attempts: number;
    correlationId?: string;
    causationId?: string;
    actor?: { userId: string; roles?: string[] };
  }): Promise<void>;

  /**
   * Record failed message delivery
   */
  recordFailed(input: {
    id: string;
    tenant: string;
    reason: string; // normalized error code (e.g., 'invalid_auth')
    attempts: number;
    retryable?: boolean;
    lastError?: string;
    correlationId?: string;
    causationId?: string;
    actor?: { userId: string; roles?: string[] };
  }): Promise<void>;
}

/**
 * DI Token for the MessageRequest Application Port
 */
export const MESSAGE_REQUEST_APP_PORT = Symbol('MESSAGE_REQUEST_APP_PORT');
