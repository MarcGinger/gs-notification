// SecureTest Field Extractor - Implements FieldExtractor interface for SecureTestProjector
// Provides unified parameter extraction for use with GenericRedisProjector

import { Injectable } from '@nestjs/common';
import { ProjectionEvent } from 'src/shared/infrastructure/projections/catchup.runner';
import { TenantExtractor } from 'src/shared/infrastructure/projections/projection.utils';
import { withContext } from 'src/shared/errors';
import { FieldExtractor, BaseProjectionParams } from 'src/shared/infrastructure/projections/generic-redis.projector';
import { SecureTestFieldValidatorUtil } from './secure-test-field-validator.util';

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
export class SecureTestFieldExtractor implements FieldExtractor<SecureTestProjectionParams> {
  
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

      // Use SecureTestFieldValidatorUtil to create projector data with SecretRefUnion support
      // The field validator handles both Doppler and Sealed SecretRef types by storing them as JSON
      // Sealed SecretRefs remain encrypted in projections, maintaining security boundaries
      const secureTestProjectorData = 
        SecureTestFieldValidatorUtil.createSecureTestProjectorDataFromEventData(eventData);

      // Override envelope fields with actual event envelope data
      // The version, createdAt, updatedAt should come from event envelope, not payload
      const eventTimestamp = 
        event.metadata?.occurredAt instanceof Date
          ? event.metadata.occurredAt
          : new Date();

      const eventEnvelope = {
        version: event.revision, // Use event revision as version
        createdAt: eventTimestamp, // Use event timestamp
        updatedAt: eventTimestamp, // Use event timestamp
      };

      // Add projector-specific fields for Redis storage
      return {
        ...secureTestProjectorData,
        ...eventEnvelope, // Override with correct envelope data
        tenant,
        deletedAt: null, // Projector handles soft deletes
        lastStreamRevision: event.revision.toString(),
      };
    } catch (error) {
      const e = error as Error;
      throw new Error(
        withContext(
          { 
            code: 'INVALID_EVENT_DATA',
            detail: 'Failed to extract SecureTest parameters from event data',
          },
          {
            eventType: event.type,
            streamId: event.streamId,
            originalError: e.message,
          }
        ).detail,
      );
    }
  }
}