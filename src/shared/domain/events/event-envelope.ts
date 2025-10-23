// Shared event infrastructure for wire-format events (primitives only)
// Based on minimal pattern for serialization, versioning, and infrastructure compatibility

import { EventMetadata } from './event-metadata';

export interface EventEnvelope<TPayload = Record<string, unknown>> {
  type: string; // e.g. 'ProductUpdated'
  schemaVersion: number; // e.g. 1
  payload: TPayload; // primitives only - JSON serializable
  metadata: EventMetadata;
}
