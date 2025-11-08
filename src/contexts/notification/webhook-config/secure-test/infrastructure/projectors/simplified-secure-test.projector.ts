// Simplified Unified Projector Approach
// Shows how SecureTestProjector can be simplified using the unified approach

import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { CatchUpRunner } from 'src/shared/infrastructure/projections/catchup.runner';
import { CheckpointStore } from 'src/shared/infrastructure/projections/checkpoint.store';
import { APP_LOGGER, Log, Logger } from 'src/shared/logging';
import { Clock, CLOCK } from 'src/shared/infrastructure/time';
import { CacheService } from 'src/shared/application/caching/cache.service';
import { EventEncryptionFactory } from 'src/shared/infrastructure/encryption';
import { WEBHOOK_CONFIG_DI_TOKENS } from '../../../webhook-config.constants';
import { NotificationSlackProjectorConfig } from '../../../projector.config';
import { SecureTestProjectionKeys } from '../../secure-test-projection-keys';
import {
  GenericRedisProjector,
  ProjectorConfig,
  BaseProjectionParams,
} from 'src/shared/infrastructure/projections/generic-redis.projector';
import { DetailSecureTestResponse } from '../../application/dtos';

/**
 * SecureTest projection parameters interface
 */
export interface SecureTestProjectionParams extends BaseProjectionParams {
  // From DetailSecureTestResponse
  slackWorkspaceId: string;
  channelConfigId: string;
  signingSecret: string;
  username: string;
  password: string;
  url: string;
  createdAt: Date;
}

/**
 * Simplified SecureTest Projector using GenericRedisProjector
 * 
 * This demonstrates how the unified approach reduces code duplication.
 * The projector is now much simpler and focuses only on:
 * 1. Configuration
 * 2. Domain-specific parameter extraction
 * 3. Custom logging (if needed)
 * 
 * All the Redis pipeline operations, caching, error handling, and lifecycle
 * management is handled by the GenericRedisProjector base class.
 */
@Injectable()
export class SimplifiedSecureTestProjector extends GenericRedisProjector<SecureTestProjectionParams> {
  
  private static readonly CONFIG: ProjectorConfig = {
    projectorName: SecureTestProjectionKeys.PROJECTOR_NAME,
    subscriptionGroup: SecureTestProjectionKeys.SUBSCRIPTION_GROUP,
    eventStoreStreamPrefix: SecureTestProjectionKeys.getEventStoreStreamPrefix(),
    versionKeyPrefix: NotificationSlackProjectorConfig.getConfig().VERSION_KEY_PREFIX,
    getRedisEntityKey: (tenant: string, id: string) => 
      SecureTestProjectionKeys.getRedisSecureTestKey(tenant, id),
    getRedisIndexKey: (tenant: string) => 
      SecureTestProjectionKeys.getRedisSecureTestIndexKey(tenant),
  };

  constructor(
    @Inject(APP_LOGGER) baseLogger: Logger,
    @Inject(CLOCK) clock: Clock,
    @Inject(WEBHOOK_CONFIG_DI_TOKENS.CATCHUP_RUNNER)
    catchUpRunner: CatchUpRunner,
    @Inject(WEBHOOK_CONFIG_DI_TOKENS.CHECKPOINT_STORE)
    checkpointStore: CheckpointStore,
    @Inject(WEBHOOK_CONFIG_DI_TOKENS.IO_REDIS)
    redis: Redis,
    @Inject(WEBHOOK_CONFIG_DI_TOKENS.CACHE_SERVICE)
    cache: CacheService,
    eventEncryptionFactory: EventEncryptionFactory, // Required for SecretRef inspection
  ) {
    super(
      SimplifiedSecureTestProjector.CONFIG,
      new InlineSecureTestFieldExtractor(), // Simple inline field extractor
      baseLogger,
      clock,
      catchUpRunner,
      checkpointStore,
      redis,
      cache,
      eventEncryptionFactory, // Pass the encryption factory for SecretRef operations
    );
  }

  /**
   * Override to add SecretRef type information for sealed SecretRef observability
   */
  protected getCustomLogData(params: SecureTestProjectionParams): Record<string, unknown> {
    // Add SecretRef type information for observability
    return {
      signingSecretType: this.inspectSecretRefType(params.signingSecret).type,
      usernameType: this.inspectSecretRefType(params.username).type,
      passwordType: this.inspectSecretRefType(params.password).type,
      hasSealedSecrets: [
        this.inspectSecretRefType(params.signingSecret),
        this.inspectSecretRefType(params.username),
        this.inspectSecretRefType(params.password),
      ].some((ref) => ref.type === 'sealed'),
      availableEncryptionStrategies: this.getAvailableEncryptionStrategies(),
    };
  }
}

/**
 * Inline Field Extractor for SecureTest
 * This could be moved to a separate file for reusability
 */
class InlineSecureTestFieldExtractor {
  extractParams(event: any): SecureTestProjectionParams {
    const eventData = event.data || {};
    const tenant = this.extractTenant(event);
    
    // Simple field extraction - you can use your existing SecureTestFieldValidatorUtil here
    return {
      id: eventData.id || '',
      tenant,
      version: event.revision || 1,
      updatedAt: event.metadata?.occurredAt || new Date(),
      deletedAt: null,
      lastStreamRevision: event.revision?.toString(),
      
      // Domain-specific fields
      slackWorkspaceId: eventData.slackWorkspaceId || '',
      channelConfigId: eventData.channelConfigId || '',
      signingSecret: eventData.signingSecret || '',
      username: eventData.username || '',
      password: eventData.password || '',
      url: eventData.url || '',
      createdAt: eventData.createdAt || new Date(),
    };
  }

  private extractTenant(event: any): string {
    // Simple tenant extraction - use your existing TenantExtractor logic
    return event.streamId?.split('-')[0] || 'default';
  }
}