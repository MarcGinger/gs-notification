// Base Projector Abstract Class
// Provides common functionality for all projectors using shared infrastructure

import { Inject } from '@nestjs/common';
import { CheckpointStore } from './checkpoint.store';
import { CHECKPOINT_STORE } from '../infrastructure.tokens';
import { APP_LOGGER, Log, Logger } from '../../logging';
import {
  BaseHealthStatus,
  ProjectorHealthStatus,
  safeJsonStringify,
} from './projection.utils';

/**
 * Abstract base class for projectors using shared infrastructure
 *
 * Provides common functionality:
 * - Health status management
 * - Checkpoint position retrieval
 * - JSON serialization utilities
 * - Logging utilities
 */
export abstract class BaseProjector {
  protected readonly logger: Logger;
  protected readonly projectorName: string;
  protected readonly subscriptionGroup: string;
  protected isRunning = false;

  /**
   * Health status for monitoring
   */
  protected healthStatus: BaseHealthStatus = {
    isHealthy: true,
    lastProcessedAt: null,
    eventsProcessed: 0,
    lastError: null,
    checkpointPosition: null,
  };

  constructor(
    projectorName: string,
    subscriptionGroup: string,
    @Inject(APP_LOGGER) protected readonly baseLogger: Logger,
    @Inject(CHECKPOINT_STORE)
    protected readonly checkpointStore: CheckpointStore,
  ) {
    this.projectorName = projectorName;
    this.subscriptionGroup = subscriptionGroup;
    this.logger = baseLogger.child({ component: projectorName });
  }

  /**
   * Safe JSON stringify with error handling
   */
  protected safeJsonStringify(value: any): string {
    return safeJsonStringify(value);
  }

  /**
   * Get health status for monitoring
   */
  getHealthStatus(): ProjectorHealthStatus {
    return {
      ...this.healthStatus,
      isRunning: this.isRunning,
      projectorName: this.projectorName,
      subscriptionGroup: this.subscriptionGroup,
    };
  }

  /**
   * Get current checkpoint position
   */
  async getCurrentCheckpoint(): Promise<string | null> {
    try {
      const checkpoint = await this.checkpointStore.get(this.subscriptionGroup);
      return checkpoint ? `${checkpoint.commit}:${checkpoint.prepare}` : null;
    } catch (error) {
      const e = error as Error;
      Log.error(this.logger, 'Failed to get current checkpoint', {
        method: 'getCurrentCheckpoint',
        subscriptionGroup: this.subscriptionGroup,
        error: e.message,
      });
      return null;
    }
  }

  /**
   * Update health status after successful event processing
   */
  protected updateHealthStatusOnSuccess(checkpointPosition?: string): void {
    this.healthStatus.eventsProcessed++;
    this.healthStatus.lastProcessedAt = new Date();
    this.healthStatus.isHealthy = true;
    if (checkpointPosition) {
      this.healthStatus.checkpointPosition = checkpointPosition;
    }
  }

  /**
   * Update health status after error
   */
  protected updateHealthStatusOnError(error: string): void {
    this.healthStatus.lastError = error;
    this.healthStatus.isHealthy = false;
  }

  /**
   * Set running state
   */
  protected setRunning(running: boolean): void {
    this.isRunning = running;
  }
}
