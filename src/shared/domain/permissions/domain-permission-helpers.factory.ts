/**
 * Domain Permission Helpers Factory
 *
 * Reusable factory for creating domain-specific permission helpers with enhanced functionality.
 * This pattern ensures DRY principles across different domains while providing comprehensive
 * permission management capabilities.
 *
 * Usage:
 * ```typescript
 * export const ProductPermissionHelpers = createDomainPermissionHelpers({
 *   domain: 'product',
 *   permissions: ProductPermission,
 *   registry: ProductPermissionRegistry,
 *   fieldMatrix: PRODUCT_FIELD_MATRIX
 * });
 * ```
 */

import {
  PermissionRiskLevel,
  PermissionOperationType,
  type BasePermissionMeta,
} from './base-permission.types';
import {
  getPermissionsByRiskLevel,
  getPermissionsByOperationType,
  getJustificationRequiredPermissions,
  getAuditRequiredPermissions,
  getPermissionsByTags,
  expandRelated,
  validateRegistryIntegrity,
  checkCircularDependencies,
  indexByRisk,
  indexByOperation,
  buildOpaInput,
  deriveFieldPermissions,
  requiresAdditionalPermissions,
  type PermissionRegistry,
  type AuthorizationActor,
  type AuthorizationResource,
  type AuthorizationContext,
} from './utils';

// ===== Factory Configuration Types =====

export interface DomainPermissionConfig<TPermission extends string> {
  /** Domain name for OPA integration */
  domain: string;
  /** Permission enum object */
  permissions: Record<string, TPermission>;
  /** Permission registry */
  registry: PermissionRegistry<TPermission>;
  /** Optional field permission matrix */
  fieldMatrix?: Record<string, readonly TPermission[]>;
}

export interface DomainPermissionStats {
  total: number;
  byRiskLevel: Record<PermissionRiskLevel, number>;
  byOperationType: Record<PermissionOperationType, number>;
  requireJustification: number;
  requireAudit: number;
}

// ===== Helper Factory Function =====

/**
 * Create domain-specific permission helpers with full functionality
 */
export function createDomainPermissionHelpers<TPermission extends string>(
  config: DomainPermissionConfig<TPermission>,
) {
  const { domain, permissions, registry, fieldMatrix } = config;

  const helpers = {
    // ===== Individual Permission Queries =====

    /**
     * Check if a permission requires justification
     */
    requiresJustification(permission: TPermission): boolean {
      const meta = registry[permission] as BasePermissionMeta;
      return meta?.requiresJustification ?? false;
    },

    /**
     * Get risk level for a permission
     */
    getRiskLevel(permission: TPermission): PermissionRiskLevel {
      const meta = registry[permission] as BasePermissionMeta;
      return meta?.riskLevel ?? PermissionRiskLevel.LOW;
    },

    /**
     * Check if permission is high risk (HIGH or CRITICAL)
     */
    isHighRisk(permission: TPermission): boolean {
      const riskLevel = helpers.getRiskLevel(permission);
      return (
        riskLevel === PermissionRiskLevel.HIGH ||
        riskLevel === PermissionRiskLevel.CRITICAL
      );
    },

    /**
     * Get policy path for OPA evaluation
     */
    getPolicyPath(permission: TPermission): string {
      const meta = registry[permission];
      return meta?.policyPath ?? '';
    },

    /**
     * Get canonical action for OPA evaluation
     */
    getCanonicalAction(permission: TPermission): string {
      const meta = registry[permission];
      return meta?.action ?? permission;
    },

    /**
     * Get policy rule ID for audit trail references
     */
    getPolicyRuleId(permission: TPermission): string {
      const meta = registry[permission];
      return meta?.policyRuleId ?? '';
    },

    /**
     * Check if permission requires audit logging
     */
    requiresAudit(permission: TPermission): boolean {
      const meta = registry[permission];
      return meta?.auditRequired === true || helpers.isHighRisk(permission);
    },

    /**
     * Get i18n key for UI localization
     */
    getI18nKey(permission: TPermission): string {
      const meta = registry[permission];
      return (
        meta?.i18nKey ?? `permissions.${domain}.${permission.toLowerCase()}`
      );
    },

    /**
     * Get tags for permission filtering
     */
    getTags(permission: TPermission): string[] {
      const meta = registry[permission] as BasePermissionMeta;
      return meta?.tags ?? [];
    },

    /**
     * Check if permission has specific tag
     */
    hasTag(permission: TPermission, tag: string): boolean {
      return helpers.getTags(permission).includes(tag);
    },

    /**
     * Get permission category
     */
    getCategory(permission: TPermission): string {
      const meta = registry[permission];
      return meta?.category ?? 'General';
    },

    /**
     * Get operation type
     */
    getOperationType(permission: TPermission): PermissionOperationType {
      const meta = registry[permission] as BasePermissionMeta;
      return meta?.operationType ?? PermissionOperationType.CUSTOM;
    },

    // ===== Bulk Permission Queries =====

    /**
     * Get all permissions by risk level
     */
    getByRiskLevel(riskLevel: PermissionRiskLevel): TPermission[] {
      return getPermissionsByRiskLevel(registry, riskLevel);
    },

    /**
     * Get all permissions by operation type
     */
    getByOperationType(operationType: PermissionOperationType): TPermission[] {
      return getPermissionsByOperationType(registry, operationType);
    },

    /**
     * Get all permissions that require justification
     */
    getJustificationRequired(): TPermission[] {
      return getJustificationRequiredPermissions(registry);
    },

    /**
     * Get all permissions that require audit logging
     */
    getAuditRequired(): TPermission[] {
      return getAuditRequiredPermissions(registry);
    },

    /**
     * Get permissions by tags
     */
    getByTags(tags: readonly string[]): TPermission[] {
      return getPermissionsByTags(registry, tags);
    },

    /**
     * Get all high-risk permissions (HIGH + CRITICAL)
     */
    getHighRiskPermissions(): TPermission[] {
      const high = helpers.getByRiskLevel(PermissionRiskLevel.HIGH);
      const critical = helpers.getByRiskLevel(PermissionRiskLevel.CRITICAL);
      return [...high, ...critical];
    },

    /**
     * Get all CRUD permissions
     */
    getCrudPermissions(): TPermission[] {
      return helpers.getByTags(['crud']);
    },

    /**
     * Get all bulk operation permissions
     */
    getBulkPermissions(): TPermission[] {
      return helpers.getByTags(['bulk']);
    },

    /**
     * Get all administrative permissions
     */
    getAdminPermissions(): TPermission[] {
      return helpers.getByTags(['admin']);
    },

    // ===== Permission Relationships & Expansion =====

    /**
     * Expand permissions to include related permissions
     */
    expandWithRelated(
      permissions: readonly TPermission[],
      maxDepth: number = 3,
    ): TPermission[] {
      return expandRelated(registry, permissions, maxDepth);
    },

    /**
     * Get all permissions related to a specific permission
     */
    getRelatedPermissions(permission: TPermission): TPermission[] {
      const meta = registry[permission] as BasePermissionMeta;
      return (meta?.relatedPermissions as TPermission[]) ?? [];
    },

    // ===== Field-Level Permission Logic =====

    /**
     * Derive required permissions from changed fields (if field matrix provided)
     */
    deriveFromFields(changedFields: readonly string[]): TPermission[] {
      if (!fieldMatrix) {
        console.warn(`No field matrix configured for ${domain} domain`);
        return [];
      }
      return deriveFieldPermissions(fieldMatrix, changedFields);
    },

    /**
     * Check if field changes require additional permissions beyond base
     */
    requiresAdditionalForFields(
      changedFields: readonly string[],
      basePermissions: readonly TPermission[],
    ): { required: TPermission[]; additional: TPermission[] } {
      if (!fieldMatrix) {
        console.warn(`No field matrix configured for ${domain} domain`);
        return { required: [], additional: [] };
      }
      return requiresAdditionalPermissions(
        fieldMatrix,
        changedFields,
        basePermissions,
      );
    },

    // ===== OPA Integration =====

    /**
     * Build OPA input for authorization request
     */
    buildOpaInput(args: {
      permissions: readonly TPermission[];
      actor: AuthorizationActor;
      resource?: AuthorizationResource;
      context: AuthorizationContext;
    }) {
      return buildOpaInput({
        ...args,
        domain,
        registry,
      });
    },

    // ===== Registry Validation & Health Checks =====

    /**
     * Validate registry integrity
     */
    validateRegistry(): { valid: boolean; errors: string[] } {
      return validateRegistryIntegrity(registry);
    },

    /**
     * Check for circular dependencies in permission relationships
     */
    checkCircularDependencies(): {
      hasCircularDeps: boolean;
      cycles: TPermission[][];
    } {
      return checkCircularDependencies(registry);
    },

    // ===== Performance Indexes =====

    /**
     * Create risk-based index for fast queries
     */
    createRiskIndex(): Record<PermissionRiskLevel, TPermission[]> {
      return indexByRisk(registry);
    },

    /**
     * Create operation-based index for fast queries
     */
    createOperationIndex(): Record<PermissionOperationType, TPermission[]> {
      return indexByOperation(registry);
    },

    // ===== Utility Methods =====

    /**
     * Check if permission exists in registry
     */
    exists(permission: string): permission is TPermission {
      return Object.values(permissions).includes(permission as TPermission);
    },

    /**
     * Get all available permissions
     */
    getAllPermissions(): TPermission[] {
      return Object.values(permissions);
    },

    /**
     * Get permission statistics
     */
    getStats(): DomainPermissionStats {
      const all = helpers.getAllPermissions();
      const riskIndex = helpers.createRiskIndex();
      const opIndex = helpers.createOperationIndex();

      return {
        total: all.length,
        byRiskLevel: {
          [PermissionRiskLevel.LOW]:
            riskIndex[PermissionRiskLevel.LOW]?.length ?? 0,
          [PermissionRiskLevel.MEDIUM]:
            riskIndex[PermissionRiskLevel.MEDIUM]?.length ?? 0,
          [PermissionRiskLevel.HIGH]:
            riskIndex[PermissionRiskLevel.HIGH]?.length ?? 0,
          [PermissionRiskLevel.CRITICAL]:
            riskIndex[PermissionRiskLevel.CRITICAL]?.length ?? 0,
        },
        byOperationType: {
          [PermissionOperationType.CRUD]:
            opIndex[PermissionOperationType.CRUD]?.length ?? 0,
          [PermissionOperationType.BULK]:
            opIndex[PermissionOperationType.BULK]?.length ?? 0,
          [PermissionOperationType.ADMIN]:
            opIndex[PermissionOperationType.ADMIN]?.length ?? 0,
          [PermissionOperationType.SENSITIVE]:
            opIndex[PermissionOperationType.SENSITIVE]?.length ?? 0,
          [PermissionOperationType.CUSTOM]:
            opIndex[PermissionOperationType.CUSTOM]?.length ?? 0,
        },
        requireJustification: helpers.getJustificationRequired().length,
        requireAudit: helpers.getAuditRequired().length,
      };
    },

    // ===== Domain-Specific Context =====

    /**
     * Get domain name
     */
    getDomain(): string {
      return domain;
    },

    /**
     * Get registry reference
     */
    getRegistry(): PermissionRegistry<TPermission> {
      return registry;
    },

    /**
     * Get field matrix reference
     */
    getFieldMatrix(): Record<string, readonly TPermission[]> | undefined {
      return fieldMatrix;
    },
  };

  return helpers;
}

// ===== Common Field Permission Matrices =====

/**
 * Common field permission matrix patterns that domains can extend
 */
export const CommonFieldMatrixPatterns = {
  /**
   * Standard CRUD field patterns
   */
  standardCrud: <TPermission extends string>(
    createPerm: TPermission,
    updatePerm: TPermission,
    adminPerm?: TPermission,
  ) => ({
    // Basic fields - require update permission
    name: [updatePerm],
    description: [updatePerm],
    active: [updatePerm],

    // Administrative fields - require admin permission if available
    metadata: adminPerm ? [adminPerm] : [updatePerm],
    systemMetadata: adminPerm ? [adminPerm] : [updatePerm],

    // Creation-only fields
    createdAt: [createPerm],
    createdBy: [createPerm],
  }),

  /**
   * Financial field patterns (higher security)
   */
  financial: <TPermission extends string>(
    updatePerm: TPermission,
    adminPerm: TPermission,
  ) => ({
    amount: [updatePerm, adminPerm],
    currency: [updatePerm, adminPerm],
    rate: [updatePerm, adminPerm],
    fees: [updatePerm, adminPerm],
  }),

  /**
   * Audit field patterns
   */
  audit: <TPermission extends string>(auditPerm: TPermission) => ({
    auditLog: [auditPerm],
    auditTrail: [auditPerm],
    complianceNotes: [auditPerm],
  }),
} as const;

// ===== Export Types for Domain Usage =====

export type DomainHelpers<TPermission extends string> = ReturnType<
  typeof createDomainPermissionHelpers<TPermission>
>;
