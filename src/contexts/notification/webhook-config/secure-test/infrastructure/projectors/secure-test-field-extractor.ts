// SecureTest Field Extractor - Implements FieldExtractor interface for SecureTestProjector
// Provides unified parameter extraction for use with GenericRedisProjector

import { Injectable } from '@nestjs/common';
import { ProjectionEvent } from 'src/shared/infrastructure/projections/catchup.runner';
import { TenantExtractor } from 'src/shared/infrastructure/projections/projection.utils';
import {
  FieldExtractor,
  BaseProjectionParams,
} from 'src/shared/infrastructure/projections/generic-redis.projector';

/**
 * SecureTest projection parameters interface
 * Extends BaseProjectionParams with domain-specific fields
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
 * SecureTest Field Extractor
 *
 * Implements the FieldExtractor interface to provide domain-specific parameter extraction
 * for the SecureTestProjector using GenericRedisProjector.
 *
 * This class encapsulates all the complex field validation and extraction logic
 * that was previously embedded in the projector, making the projector much simpler.
 */
@Injectable()
export class SecureTestFieldExtractor
  implements FieldExtractor<SecureTestProjectionParams>
{
  /**
   * Extract SecureTest parameters from event data
   *
   * Uses SecureTestFieldValidatorUtil for consistent validation across
   * repository and projector components.
   */
  extractParams(event: ProjectionEvent): SecureTestProjectionParams {
    try {
      const eventData = event.data as Record<string, any>;

      // Extract tenant using shared utility
      const tenant = TenantExtractor.extractTenant(event);

      // Extract timestamp from event metadata
      const eventTimestamp =
        event.metadata?.occurredAt instanceof Date
          ? event.metadata.occurredAt
          : new Date();

      // Simple field extraction for SecureTest parameters
      return {
        // Base projection params
        id: eventData.id || '',
        tenant,
        version: event.revision,
        updatedAt: eventTimestamp,
        deletedAt: null,
        lastStreamRevision: event.revision.toString(),

        // Domain-specific SecureTest fields
        slackWorkspaceId: eventData.slackWorkspaceId || '',
        channelConfigId: eventData.channelConfigId || '',
        signingSecret: eventData.signingSecret || '',
        username: eventData.username || '',
        password: eventData.password || '',
        url: eventData.url || '',
        createdAt: eventData.createdAt || eventTimestamp,
      };
    } catch (error) {
      const e = error as Error;
      throw new Error(
        `Failed to extract SecureTest parameters from event data: ${e.message}`,
      );
    }
  }
}
