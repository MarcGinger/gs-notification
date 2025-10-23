/**
 * Shared types for EventStoreDB events and metadata
 * Following the DDD + CQRS + Event Sourcing patterns
 */

import { EventMetadata } from './event-metadata';

export type EventMeta = {
  eventId: string; // GUID
  correlationId: string; // trace across services
  causationId: string; // prior event/command id
  commandId: string; // idempotency key
  tenant: string; // 'core', 'acme', ...
  user?: { id: string; email?: string; name?: string };
  source: string; // service/module name
  occurredAt: string; // ISO timestamp
  schemaVersion: number; // payload schema version
  contentType?: 'application/json+domain';
};

export type EventEnvelope<T> = {
  type: string; // event type name (versioned)
  data: T; // payload
  metadata: EventMeta; // uniform envelope
};

export type Snapshot<TState> = {
  aggregate: string; // banking.currency
  aggregateSchema: number; // e.g., 1
  tenant: string;
  entityId: string;
  state: TState; // serialized aggregate state
  version: number; // aggregate version at capture
  streamPosition: bigint; // commit/prepare or revision marker
  takenAt: string; // ISO timestamp
};

/**
 * Base domain event interface for event sourcing
 *
 * Unified interface that serves as the standard for all domain events
 * across the application. Provides consistent structure for event store
 * persistence, projection, and aggregate rehydration.
 */
export interface DomainEvent {
  readonly type: string; // Event type in domain.action.version format
  readonly version: number; // Event schema version
  readonly occurredAt: Date; // When the event occurred
  readonly aggregateId: string; // ID of the aggregate that produced this event
  readonly aggregateType: string; // Type of aggregate (Channel, Product, etc.)
  readonly data?: unknown; // Event payload - optional for simple events
  readonly metadata?: EventMetadata; // Event metadata - optional for backward compatibility
}

// Result type and helpers moved to src/shared/errors for consolidation
// Import from there: import { Result, ok, err } from 'src/shared/errors';
