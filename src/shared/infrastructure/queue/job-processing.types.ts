/**
 * Generic Job Processing Types
 *
 * Reusable types for job processing across different contexts and services.
 * These types are service-agnostic and can be used with any queue/worker implementation.
 */

/**
 * Generic Job Processing Result
 *
 * Standard result interface for any job processing operation.
 * Can be extended by specific contexts for additional metadata.
 */
export interface JobProcessingResult {
  /** Whether the job was processed successfully */
  success: boolean;

  /** Optional result message */
  message?: string;

  /** Processing metadata */
  metadata?: JobProcessingMetadata;
}

/**
 * Generic Job Processing Metadata
 *
 * Standard metadata that can be collected during job processing.
 * Individual services can extend this interface for service-specific data.
 */
export interface JobProcessingMetadata {
  /** Time taken to process (milliseconds) */
  processingTimeMs?: number;

  /** Number of internal retries attempted */
  retriesAttempted?: number;

  /** Final message timestamp/ID from the messaging service */
  messageTimestamp?: string;

  /** Target channel/destination where message was sent */
  targetChannel?: string;

  /** Additional service-specific metadata */
  [key: string]: unknown;
}

/**
 * Generic Job Processing Error
 *
 * Standard error interface for job processing failures.
 * Provides consistent error handling across different job types.
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

/**
 * Generic Job Processing Options
 *
 * Base options that can be extended by specific job types.
 * Follows BullMQ JobsOptions pattern but with generic defaults.
 */
export interface BaseJobOptions {
  /** Number of retry attempts */
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
 * Standard job options for most use cases
 */
export const DEFAULT_JOB_OPTIONS: BaseJobOptions = {
  attempts: 1, // Single attempt by default, let services handle internal retries
  removeOnComplete: 100, // Keep last 100 successful jobs for debugging
  removeOnFail: 50, // Keep last 50 failed jobs for analysis
} as const;
