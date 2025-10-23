import { ActorContext } from 'src/shared/application/context/actor-context';

/**
 * Security context for events and commands
 * Contains authentication and authorization metadata
 */
export interface SecurityMetadata {
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  roles?: string[];
  permissions?: string[];
  authorizationReason?: string;
  dataProtectionApplied?: boolean;
  piiFieldsProtected?: string[];
}

export interface EventMetadata {
  // ---- Actor (who) ----
  actor: ActorContext & {
    sessionId?: string;
  };

  // ---- Trace (why/how) ----
  correlationId: string;
  causationId?: string;
  requestId?: string;
  source?: string;

  // ---- Environment/time (when/where) ----
  service: string; // e.g., 'catalog-service'
  timestampIso: string; // ISO 8601 from Clock
  ip?: string;
  userAgent?: string;

  // ---- Idempotency/versioning ----
  idemKey?: string;
  eventVersion: string; // e.g., "1.0.0"
  schemaVersion: string; // e.g., "2023.1"

  // ---- Security/compliance ----
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  encryptionRequired?: boolean;
  piiProtected?: boolean;
  encryptionKeyId?: string;

  // ---- Perf/debug ----
  operationId?: string;
  processingTimeMs?: number;

  // ---- Flexible context ----
  context?: Record<string, unknown>;

  // ---- Domain identity (what entity) ----
  aggregate?: {
    id: string; // ✅ aggregateId (Product code/UUID/etc.)
    type: string; // e.g., 'Product'
    streamId?: string; // ESDB stream name if useful off-bus
    revision?: number; // stream revision at append time
  };

  // Domain-safe extras
  [k: string]: unknown;
}
