import { Result, DomainError } from '../../errors';

export interface SaveReceipt {
  stream: string;
  aggregateId: string;
  tenantId: string;
  eventCount: number;
  /** Domain version after append, if known (e.g., when caller supplies expectedVersion) */
  newVersion?: number;
  /** ESDB next expected revision (bigint). Serialize to string at API boundary if needed. */
  streamRevision: bigint | string; // never number to avoid overflow
  timestampIso: string;
  correlationId?: string;
  position?: string; // ESDB commit/prepare position if available
  operationId?: string; // For tracking and debugging
}

/**
 * Metadata for write operations (command tracing and correlation)
 * Used across all domain writer repositories for consistent event metadata
 */
export interface WriteOperationMetadata {
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** ID of the command or event that caused this operation */
  causationId?: string;
  /** Unique command identifier for idempotency */
  commandId?: string;
}

export interface RepositoryOptions {
  correlationId?: string;
  expectedRevision?: number; // or a domain-agnostic OptimisticLock token
  causationId?: string;
  requestId?: string;
  idemKey?: string;
  source?: string;
  timeout?: number; // Operation timeout in milliseconds
  cache?: CacheOptions; // Cache options for this operation
}

// Enhanced types for future implementation
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  cacheKey?: string; // Custom cache key
  skipCache?: boolean; // Bypass cache for this operation
  refreshCache?: boolean; // Force cache refresh
}

export interface RepositoryMetrics {
  recordSaveOperation(
    duration: number,
    success: boolean,
    entityType: string,
  ): void;
  recordQueryOperation(type: string, duration: number, cacheHit: boolean): void;
  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'invalidate',
    key: string,
  ): void;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  details: Record<string, unknown>;
}

export interface ConnectionStats {
  activeConnections: number;
  totalConnections: number;
  avgResponseTime: number;
  errorRate: number;
}

export interface RepositoryHealth {
  healthCheck(): Promise<Result<HealthStatus, DomainError>>;
  isConnected(): boolean;
  getConnectionStats(): ConnectionStats;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  exponentialBackoff: boolean;
}

// Enhanced RepositoryOptions for future use
export interface EnhancedRepositoryOptions extends RepositoryOptions {
  cache?: CacheOptions;
  retryPolicy?: RetryPolicy;
}
