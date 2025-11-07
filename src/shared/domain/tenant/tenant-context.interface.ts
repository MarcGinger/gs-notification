/**
 * Tenant Context Interface for SecretRef Operations
 *
 * Provides tenant identification and context for sealed SecretRef operations.
 * This context is essential for determining which KEK to use for encryption/decryption
 * and ensuring proper tenant isolation in multi-tenant scenarios.
 */

export interface TenantContext {
  /**
   * Unique tenant identifier (e.g., 'core', 'acme', 'enterprise-customer-123')
   * Used to derive KEK names: TENANT_KEK_${tenant.toUpperCase()}_V1
   */
  readonly tenantId: string;

  /**
   * Optional tenant name for display purposes
   */
  readonly tenantName?: string;

  /**
   * Optional organization/workspace identifier
   * May be different from tenantId in hierarchical tenant structures
   */
  readonly organizationId?: string;

  /**
   * Tenant tier/plan for feature access control
   * Affects which encryption algorithms and key sizes are available
   */
  readonly tenantTier?: 'free' | 'professional' | 'enterprise';

  /**
   * Region for data residency compliance
   * May affect which KEK storage locations are used
   */
  readonly region?: string;

  /**
   * Additional tenant metadata for extensibility
   */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Tenant Context Validation
 */
export function validateTenantContext(context: TenantContext): void {
  if (!context.tenantId) {
    throw new Error('TenantContext.tenantId is required');
  }

  // Validate tenant ID format (alphanumeric, hyphens, underscores only)
  const tenantIdRegex = /^[a-zA-Z0-9_-]+$/;
  if (!tenantIdRegex.test(context.tenantId)) {
    throw new Error(
      'TenantContext.tenantId must contain only alphanumeric characters, hyphens, and underscores',
    );
  }

  // Prevent excessively long tenant IDs that could cause issues with KEK key names
  if (context.tenantId.length > 50) {
    throw new Error('TenantContext.tenantId must be 50 characters or less');
  }
}

/**
 * Create TenantContext from minimal input
 */
export function createTenantContext(
  tenantId: string,
  options: Partial<Omit<TenantContext, 'tenantId'>> = {},
): TenantContext {
  const context: TenantContext = {
    tenantId,
    ...options,
  };

  validateTenantContext(context);
  return context;
}

/**
 * Extract tenant ID for KEK derivation
 */
export function getTenantKekId(context: TenantContext, version = 'V1'): string {
  return `TENANT_KEK_${context.tenantId.toUpperCase()}_${version}`;
}
