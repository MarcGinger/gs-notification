/**
 * Typed context for authorization operations.
 * Replaces generic Record<string, any> for better type safety and ABAC support.
 *
 * This interface can be extended by domain-specific authorization contexts.
 */
export interface AuthContext {
  /** Tenant ID for multi-tenant authorization */
  tenantId?: string;

  /** User roles for role-based access control */
  roles?: string[];

  /** Operation type for audit trails */
  operationType?: string;

  /** Additional metadata for request context (IP, device, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * Union type for supported CRUD operations
 */
export type CrudOperation = 'create' | 'read' | 'update' | 'delete';

/**
 * Union type for batch operations (excludes create as it's typically not done in batches)
 */
export type BatchOperation = 'read' | 'update' | 'delete';
