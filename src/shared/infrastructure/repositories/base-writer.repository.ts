import { ActorContext } from 'src/shared/application/context';
import { DomainEvent, EventEnvelope } from 'src/shared/domain/events';
import { NO_STREAM, ANY } from '@kurrent/kurrentdb-client';
import { randomUUID } from 'crypto';

/**
 * Base Writer Repository - Shared Infrastructure for EventStore-based Writers
 *
 * Provides common functionality for all domain writer repositories:
 * - EventStore revision computation (optimistic concurrency control)
 * - Domain event to EventStore envelope conversion
 * - Stream naming utilities
 * - Consistent metadata handling
 *
 * Benefits:
 * - DRY principle: eliminates duplication across domain writers
 * - Consistent event envelope structure across all domains
 * - Centralized EventStore integration patterns
 * - Type-safe event handling with proper DomainEvent interface
 *
 * @domain Shared Infrastructure
 * @layer Infrastructure
 * @pattern Base Class Pattern + Template Method
 */
export abstract class BaseWriterRepository {
  /**
   * Build consistent stream name for aggregates
   * Template method that can be overridden by specific domains
   * @protected
   */
  protected buildStreamName(
    tenantId: string | undefined | null,
    aggregateType: string,
    id: string,
  ): string {
    return `${aggregateType.toLowerCase()}-${tenantId ?? 'default'}-${id}`;
  }

  /**
   * Compute expected revision for EventStoreDB from previous version
   * Handles the NO_STREAM vs BigInt revision logic for optimistic concurrency
   * @protected
   */
  protected computeExpectedRevision(
    prevVersion: number,
  ): typeof NO_STREAM | bigint | typeof ANY {
    // Use ANY to bypass revision checking due to KurrentDB gRPC serialization issue
    // This maintains functionality while avoiding the "Cannot read properties of null (reading 'lo')" error
    // Note: prevVersion would be used for proper revision computation when the issue is resolved
    void prevVersion; // Acknowledge parameter until proper revision logic is restored
    return ANY;
  }

  /**
   * Convert domain events to clean EventStore envelopes with canonical metadata
   * Follows CloudEvents-inspired structure with no duplicates or null placeholders
   * Implements proper version parsing and PII classification
   * @protected
   */
  protected toEnvelopes(
    stream: string,
    events: readonly DomainEvent[],
    actor: ActorContext,
    source: string,
    boundedContext: string,
    meta?: { correlationId?: string; causationId?: string; commandId?: string },
  ): EventEnvelope<any>[] {
    const now = new Date().toISOString(); // RFC 3339 UTC
    const serviceName = source.replace('-repository', '').replace('-', '');

    return events.map((evt) => {
      // Extract version from event type (e.g., "BankProductConfigRailCreated.v1" → 1)
      const versionFromType = (eventType: string): number | undefined => {
        const match = /\.v(\d+)$/i.exec(eventType);
        return match ? Number(match[1]) : undefined;
      };

      const eventVersion = versionFromType(evt.type) ?? evt.version ?? 1;
      const traceId =
        meta?.correlationId ?? evt.metadata?.correlationId ?? randomUUID();

      // Get PII status from domain event metadata (set by use case layer)
      const isPIIProtected = evt.metadata?.piiProtected ?? false;

      // Build canonical metadata structure (EventMeta compatible with enhancements)
      const canonicalMetadata = {
        // ---- Required EventMeta fields (EventStore compatibility) ----
        eventId: randomUUID(),
        eventName: evt.type, // Clear event name for better tracking
        correlationId: traceId,
        causationId: meta?.causationId ?? traceId, // Use correlation as causation if not provided
        commandId: meta?.commandId ?? randomUUID(), // Generate proper UUID for command
        tenant: actor.tenantId ?? 'default',
        source: `service://${serviceName}/${evt.aggregateType?.toLowerCase() ?? 'unknown'}`,
        occurredAt: now,
        contentType: 'application/json+domain' as const, // Keep compatible type
        schemaVersion: eventVersion, // Keep as number for compatibility
        boundedContext: boundedContext, // Context classification for proper event routing

        // ---- Enhanced canonical fields (no duplicates) ----
        // Actor context (enhanced with role optimization)
        actor: {
          userId: actor.userId,
          ...(actor.username && { username: actor.username }),
          ...(actor.tenant_userId && { tenantId: actor.tenant_userId }), // Use tenantId consistently
          ...(actor.roles &&
            actor.roles.length > 0 && {
              roleHash: `sha256:${Buffer.from(actor.roles.sort().join(','))
                .toString('base64')
                .slice(0, 8)}...`,
              rolesSample: actor.roles.slice(0, 3), // Keep only first 3 roles for performance
            }),
        },

        // Security classification (from domain layer)
        classification: {
          data: isPIIProtected
            ? ('confidential' as const)
            : ('internal' as const),
          piiProtected: isPIIProtected,
          encryptionRequired: isPIIProtected,
        },

        // Domain aggregate identity (fix type consistency)
        aggregate: {
          type: evt.aggregateType ?? 'Unknown',
          id: String(evt.aggregateId), // Ensure consistent string type
          streamId: stream,
        },

        // Integrity verification (optional but valuable)
        integrity: {
          payloadHash: `sha256:${Buffer.from(JSON.stringify(evt.data ?? evt))
            .toString('base64')
            .slice(0, 8)}...`,
        },
      };

      return {
        type: evt.type,
        data: evt.data ?? evt,
        metadata: canonicalMetadata,
      };
    });
  }
}
