/**
 * Standardized Projection Event System
 *
 * Unified event interface that all domain events should conform to
 * for consistent projection processing across all bounded contexts
 */

export interface ProjectionEvent {
  /**
   * Unique identifier for this event instance
   */
  eventId: string;

  /**
   * Event type in domain.action.version format
   * Examples: 'product.created.v1', 'channel.updated.v2'
   */
  eventType: string;

  /**
   * ID of the aggregate that produced this event
   */
  aggregateId: string;

  /**
   * Type of aggregate (product, channel, rail, etc.)
   */
  aggregateType: string;

  /**
   * Aggregate version after this event
   */
  version: number;

  /**
   * When the event occurred
   */
  timestamp: Date;

  /**
   * Event payload data
   */
  data: Record<string, unknown>;

  /**
   * Optional metadata for correlation, causation, etc.
   */
  metadata?: EventMetadata;
}

// EventMetadata interface consolidated - import from event-metadata.ts
import { EventMetadata } from './event-metadata';

/**
 * Context information for event processing
 */
export interface EventContext {
  revision: number;
  timestamp: Date;
  tenant: string;
  correlationId?: string;
  causationId?: string;
  userId?: string;
}

/**
 * Side effects that can be triggered by event processing
 */
export interface SideEffect {
  type: 'cache_invalidation' | 'notification' | 'audit' | 'metric' | 'event';
  data: Record<string, unknown>;
  delayMs?: number;
  priority?: number;
}

/**
 * Result of processing a projection event
 */
export interface ProjectionResult<TEntity> {
  /**
   * The resulting entity after processing
   */
  entity: TEntity;

  /**
   * Whether this was a creation (vs update)
   */
  wasCreated: boolean;

  /**
   * New version of the entity
   */
  version: number;

  /**
   * Side effects to execute
   */
  sideEffects: SideEffect[];
}

/**
 * Event adapter interface for converting domain events to ProjectionEvent
 */
export interface ProjectionEventAdapter<TDomainEvent> {
  /**
   * Check if this adapter can handle the domain event
   */
  canAdapt(domainEvent: TDomainEvent): boolean;

  /**
   * Convert domain event to standardized ProjectionEvent
   */
  adapt(domainEvent: TDomainEvent, context: EventContext): ProjectionEvent;

  /**
   * Get the event types this adapter handles
   */
  getSupportedEventTypes(): string[];
}
