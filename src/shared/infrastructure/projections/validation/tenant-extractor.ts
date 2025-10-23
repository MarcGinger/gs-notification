// Tenant Extraction Utilities
// Generic tenant extraction logic for multi-tenant projectors

import { ProjectionEvent } from '../catchup.runner';

/**
 * Tenant Extractor - Generic utilities for extracting tenant information from events
 *
 * Provides consistent tenant identification patterns that can be reused across all projectors
 * instead of duplicating tenant extraction logic in each projector.
 */
export class TenantExtractor {
  /**
   * Extract tenant ID from projection event using the standardized metadata structure
   *
   * PRIMARY: event.metadata.actor.tenantId (standardized approach)
   * FALLBACKS: Legacy patterns for migration period only
   *
   * @param event - Projection event to extract tenant from
   * @param defaultTenant - Default tenant if none found (default: 'default')
   * @param strictMode - If true, only use actor.tenantId (default: false for migration)
   * @returns Tenant identifier string
   */
  static extractTenant(
    event: ProjectionEvent,
    defaultTenant = 'default',
  ): string {
    // PRIMARY STRATEGY: Use standardized actor.tenantId (this is the target state)
    if (
      event.metadata?.actor?.tenantId &&
      typeof event.metadata.actor.tenantId === 'string'
    ) {
      return event.metadata.actor.tenantId;
    }
    return defaultTenant;
  }

  /**
   * Create multi-tenant cache key
   *
   * @param prefix - Key prefix (e.g., projector name)
   * @param tenant - Tenant identifier
   * @param suffix - Key suffix (e.g., entity code)
   * @returns Formatted cache key
   */
  static createTenantKey(
    prefix: string,
    tenant: string,
    suffix: string,
  ): string {
    return `${prefix}:${tenant}:${suffix}`;
  }
}
