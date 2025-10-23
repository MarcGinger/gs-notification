/**
 * Projection Repository Interfaces
 *
 * Provides abstraction layer for projection persistence operations
 * Supporting multiple backends (Redis, PostgreSQL, Hybrid)
 */

export interface ProjectionResult {
  success: boolean;
  version: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ProjectionTransaction {
  /**
   * Commit all operations in transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback all operations in transaction
   */
  rollback(): Promise<void>;

  /**
   * Check if transaction is active
   */
  isActive(): boolean;
}

/**
 * Generic repository interface for projection entities
 */
export interface ProjectionRepository<TEntity, TKey> {
  /**
   * Find entity by primary key
   */
  findById(id: TKey): Promise<TEntity | null>;

  /**
   * Save entity (create or update)
   */
  save(entity: TEntity): Promise<ProjectionResult>;

  /**
   * Delete entity by primary key
   */
  delete(id: TKey): Promise<void>;

  /**
   * Begin database transaction
   */
  beginTransaction(): Promise<ProjectionTransaction>;

  /**
   * Check if entity exists
   */
  exists(id: TKey): Promise<boolean>;

  /**
   * Get current version of entity
   */
  getVersion(id: TKey): Promise<number | null>;

  /**
   * Find entities by criteria
   */
  findByCriteria(criteria: ProjectionCriteria): Promise<TEntity[]>;

  /**
   * Count entities matching criteria
   */
  count(criteria?: ProjectionCriteria): Promise<number>;

  /**
   * Bulk operations for performance
   */
  saveMany(entities: TEntity[]): Promise<ProjectionResult[]>;
  deleteMany(ids: TKey[]): Promise<void>;
}

/**
 * Query criteria for projection repositories
 */
export interface ProjectionCriteria {
  filters?: Record<string, unknown>;
  sorting?: ProjectionSort[];
  pagination?: ProjectionPagination;
  tenant?: string;
}

export interface ProjectionSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ProjectionPagination {
  offset: number;
  limit: number;
}

/**
 * Repository factory for creating repository instances
 */
export interface ProjectionRepositoryFactory {
  /**
   * Create repository for specific entity type
   */
  createRepository<TEntity, TKey>(
    entityType: string,
    keyType: 'string' | 'number',
  ): ProjectionRepository<TEntity, TKey>;

  /**
   * Get supported entity types
   */
  getSupportedEntityTypes(): string[];
}

/**
 * Repository health information
 */
export interface RepositoryHealth {
  isHealthy: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  latencyMs: number;
  errorCount: number;
  lastError?: string;
  metadata?: Record<string, unknown>;
}
