/**
 * BullMQ Job Schema and Queue Configuration for MessageRequest Processing
 *
 * Purpose: Define minimal job payloads, queue options, and processing types
 * following the reference-only, secret-free principles from refinement.md
 */

import { JobsOptions } from 'bullmq';

/**
 * SendMessageJob - Minimal BullMQ job payload
 *
 * Following principles:
 * - Reference only: carries identifiers, not full objects
 * - Secret-free: no tokens, signing secrets, or config blobs
 * - Single source of truth: ESDB stream + Redis snapshot are authoritative
 */
export interface SendMessageJob {
  /** UUID of the MessageRequest */
  messageRequestId: string;

  /** Logical tenant key for multi-tenancy */
  tenant: string;

  /** Optional Slack thread timestamp for threaded replies */
  threadTs?: string | null;
}

/**
 * Queue Configuration Constants
 */
export const MESSAGE_REQUEST_QUEUE = {
  /** Queue name for BullMQ */
  NAME: 'MessageRequestQueue',

  /** Job name for send operations */
  JOB_NAME: 'send-message-request',
} as const;

/**
 * Recommended Job Options for MessageRequest processing
 *
 * - attempts: 1 (executor implements Slack-aware internal retries)
 * - removeOnComplete/removeOnFail: Prevent queue bloat
 */
export interface SendMessageJobOptions extends JobsOptions {
  /** Number of retry attempts (default: 1, worker handles internal retries) */
  attempts?: number;

  /** Job priority (higher number = higher priority) */
  priority?: number;

  /** Delay before processing (milliseconds) */
  delay?: number;

  /** Number of completed jobs to keep */
  removeOnComplete?: number;

  /** Number of failed jobs to keep */
  removeOnFail?: number;
}

/**
 * Default job options following refinement.md recommendations
 */
export const DEFAULT_SEND_MESSAGE_JOB_OPTIONS: SendMessageJobOptions = {
  attempts: 1, // Single attempt, worker handles Slack API retries internally
  removeOnComplete: 100, // Keep last 100 successful jobs for debugging
  removeOnFail: 50, // Keep last 50 failed jobs for analysis
} as const;

/**
 * Job Processing Result Types
 */
export interface JobProcessingResult {
  /** Whether the job was processed successfully */
  success: boolean;

  /** Optional result message */
  message?: string;

  /** Processing metadata */
  metadata?: {
    /** Time taken to process (milliseconds) */
    processingTimeMs?: number;

    /** Number of internal retries attempted */
    retriesAttempted?: number;

    /** Final Slack message timestamp if sent */
    slackTs?: string;

    /** Channel where message was sent */
    slackChannel?: string;
  };
}

/**
 * Job Processing Error Types
 */
export interface JobProcessingError {
  /** Error code for categorization */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Whether this error type is retryable */
  retryable: boolean;

  /** Additional error context (no secrets) */
  context?: Record<string, unknown>;
}
