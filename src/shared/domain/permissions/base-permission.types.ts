/**
 * Base Permission Metadata Interface
 *
 * Provides common structure for all domain permission metadata
 * across the application to maintain consistency and type safety.
 */
export interface BasePermissionMeta {
  /** Human-readable description for documentation/UI */
  description: string;
  /** Risk level for audit/monitoring purposes - now uses proper enum */
  riskLevel: PermissionRiskLevel;
  /** Required business justification categories */
  requiresJustification?: boolean;
  /** Related permissions (for UI grouping/hierarchies) */
  relatedPermissions?: string[];
  /** OPA policy path this permission maps to */
  policyPath?: string;
  /** Permission category for grouping/organization */
  category?: string;
  /** Whether this permission requires audit logging */
  auditRequired?: boolean;
  /** Permission name for display purposes */
  name?: string;
  /** Canonical action string for OPA evaluation - stable identifier */
  action?: string;
  /** Tags for filtering and classification - replaces brittle string includes() */
  tags?: string[];
  /** Operation type for semantic filtering */
  operationType?: PermissionOperationType;
  /** Policy rule ID for audit trail references */
  policyRuleId?: string;
  /** Tenant scope if applicable for multi-tenant systems */
  tenantScope?: PermissionTenantScope;
  /** i18n key for localized UI labels */
  i18nKey?: string;
  /** Additional metadata for domain-specific extensions */
  metadata?: Record<string, unknown>;
}

/**
 * Permission Operation Type Enumeration
 * Categorizes the type of operation a permission grants
 */
export enum PermissionOperationType {
  CRUD = 'crud',
  BULK = 'bulk',
  ADMIN = 'admin',
  SENSITIVE = 'sensitive',
  CUSTOM = 'custom',
}

/**
 * Permission Tenant Scope Enumeration
 * Defines the scope of permission access in multi-tenant systems
 */
export enum PermissionTenantScope {
  GLOBAL = 'global',
  TENANT = 'tenant',
  USER = 'user',
}

/**
 * Base Permission Registry Type
 *
 * Generic type for creating permission registries with metadata
 */
export type BasePermissionRegistry<T extends string> = Record<
  T,
  BasePermissionMeta
>;

/**
 * Base Permission Hierarchy Type
 *
 * Generic type for creating permission hierarchies for roles
 */
export type BasePermissionHierarchy<T extends string> = Record<
  string,
  readonly T[]
>;

/**
 * Risk Level Constants
 */
export const PermissionRiskLevel = {
  LOW: 'LOW' as const,
  MEDIUM: 'MEDIUM' as const,
  HIGH: 'HIGH' as const,
  CRITICAL: 'CRITICAL' as const,
} as const;

export type PermissionRiskLevel =
  (typeof PermissionRiskLevel)[keyof typeof PermissionRiskLevel];

/**
 * OPA Action Structure
 */
export interface OpaActionStructure {
  type: string;
  name: string;
}

/**
 * Base Permission Utilities Class
 *
 * Provides common utility methods that can be extended by domain-specific
 * permission utility classes
 */
export abstract class BasePermissionUtils<T extends string> {
  protected abstract readonly permissionRegistry: BasePermissionRegistry<T>;
  protected abstract readonly permissionHierarchies: BasePermissionHierarchy<T>;

  /**
   * Get permission metadata
   */
  getMetadata(permission: T): BasePermissionMeta {
    return this.permissionRegistry[permission];
  }

  /**
   * Get all permissions for a hierarchy level
   */
  getHierarchyPermissions(hierarchy: string): T[] {
    const permissions = this.permissionHierarchies[hierarchy];
    return permissions ? [...permissions] : [];
  }

  /**
   * Check if permission requires business justification
   */
  requiresJustification(permission: T): boolean {
    return this.permissionRegistry[permission].requiresJustification === true;
  }

  /**
   * Get permissions by risk level
   */
  getPermissionsByRiskLevel(riskLevel: PermissionRiskLevel): T[] {
    return Object.entries(this.permissionRegistry)
      .filter(
        ([, meta]) => (meta as BasePermissionMeta).riskLevel === riskLevel,
      )
      .map(([permission]) => permission as T);
  }

  /**
   * Get high-risk permissions for audit reporting
   */
  getHighRiskPermissions(): T[] {
    return Object.entries(this.permissionRegistry)
      .filter(([, meta]) =>
        ['HIGH', 'CRITICAL'].includes(
          (meta as BasePermissionMeta).riskLevel as string,
        ),
      )
      .map(([permission]) => permission as T);
  }

  /**
   * Generate OPA input action from permission
   */
  toOpaAction(permission: T): OpaActionStructure {
    const [type] = permission.split(':');
    return {
      type,
      name: permission,
    };
  }

  /**
   * Validate permission format (resource:action pattern)
   */
  validatePermissionFormat(permission: string): boolean {
    const parts = permission.split(':');
    return parts.length >= 2 && parts.every((part) => part.length > 0);
  }

  /**
   * Get permission resource type
   */
  getPermissionResource(permission: T): string {
    return permission.split(':')[0];
  }

  /**
   * Get permission action
   */
  getPermissionAction(permission: T): string {
    const parts = permission.split(':');
    return parts.slice(1).join(':');
  }

  /**
   * Group permissions by resource type
   */
  groupPermissionsByResource(): Record<string, T[]> {
    const groups: Record<string, T[]> = {};

    Object.keys(this.permissionRegistry).forEach((permission) => {
      const resource = this.getPermissionResource(permission as T);
      if (!groups[resource]) {
        groups[resource] = [];
      }
      groups[resource].push(permission as T);
    });

    return groups;
  }

  /**
   * Get related permissions (for dependency analysis)
   */
  getRelatedPermissions(permission: T): T[] {
    const meta = this.permissionRegistry[permission];
    return (meta.relatedPermissions as T[]) || [];
  }

  /**
   * Get permissions by tags (replaces brittle string includes)
   */
  getPermissionsByTags(tags: string[]): T[] {
    return Object.entries(this.permissionRegistry)
      .filter(([, meta]) =>
        tags.some((tag) => (meta as BasePermissionMeta).tags?.includes(tag)),
      )
      .map(([permission]) => permission as T);
  }

  /**
   * Get permissions by operation type
   */
  getPermissionsByOperationType(
    operationType: BasePermissionMeta['operationType'],
  ): T[] {
    return Object.entries(this.permissionRegistry)
      .filter(
        ([, meta]) =>
          (meta as BasePermissionMeta).operationType === operationType,
      )
      .map(([permission]) => permission as T);
  }

  /**
   * Get canonical action for permission (for OPA evaluation)
   */
  getCanonicalAction(permission: T): string {
    const meta = this.permissionRegistry[permission];
    return meta.action || permission;
  }

  /**
   * Get permissions that require justification
   */
  getJustificationRequiredPermissions(): T[] {
    return Object.entries(this.permissionRegistry)
      .filter(
        ([, meta]) =>
          (meta as BasePermissionMeta).requiresJustification === true,
      )
      .map(([permission]) => permission as T);
  }

  /**
   * Get permissions that require audit logging
   */
  getAuditRequiredPermissions(): T[] {
    return Object.entries(this.permissionRegistry)
      .filter(([, meta]) => (meta as BasePermissionMeta).auditRequired === true)
      .map(([permission]) => permission as T);
  }

  /**
   * Check if permission should be audited based on risk level or explicit flag
   */
  shouldAuditPermission(permission: T): boolean {
    const meta = this.permissionRegistry[permission];
    return (
      meta.auditRequired === true ||
      meta.riskLevel === PermissionRiskLevel.HIGH ||
      meta.riskLevel === PermissionRiskLevel.CRITICAL
    );
  }

  /**
   * Export registry to JSON for admin UI and documentation
   */
  toJson(): Record<string, BasePermissionMeta> {
    return { ...this.permissionRegistry };
  }

  /**
   * Validate registry integrity - ensure all enum values have metadata
   */
  validateRegistryIntegrity(enumValues: T[]): { valid: boolean; missing: T[] } {
    const registryKeys = Object.keys(this.permissionRegistry) as T[];
    const missing = enumValues.filter(
      (enumValue) => !registryKeys.includes(enumValue),
    );
    return {
      valid: missing.length === 0,
      missing,
    };
  }
}

/**
 * Permission Factory Helper
 *
 * Utility functions for creating permission metadata objects
 */
export class PermissionFactory {
  /**
   * Create basic CRUD permission metadata
   */
  static createCrudMeta(
    resource: string,
    action: 'create' | 'read' | 'update' | 'delete',
    overrides: Partial<BasePermissionMeta> = {},
  ): BasePermissionMeta {
    const defaultRiskLevels = {
      read: PermissionRiskLevel.LOW,
      create: PermissionRiskLevel.MEDIUM,
      update: PermissionRiskLevel.MEDIUM,
      delete: PermissionRiskLevel.HIGH,
    };

    const defaultDescriptions = {
      create: `Create new ${resource} entries`,
      read: `View ${resource} information`,
      update: `Modify existing ${resource} entries`,
      delete: `Permanently remove ${resource} entries`,
    };

    return {
      description: defaultDescriptions[action],
      riskLevel: defaultRiskLevels[action],
      requiresJustification: action === 'delete',
      policyPath: `${resource}.${action}`,
      action: `${resource}:${action}`,
      operationType: PermissionOperationType.CRUD,
      tags: ['crud', action],
      auditRequired: action === 'delete',
      ...overrides,
    };
  }

  /**
   * Create custom permission metadata
   */
  static createCustomMeta(
    description: string,
    riskLevel: PermissionRiskLevel,
    policyPath: string,
    options: Partial<BasePermissionMeta> = {},
  ): BasePermissionMeta {
    return {
      description,
      riskLevel,
      policyPath,
      operationType: PermissionOperationType.CUSTOM,
      tags: options.tags || [PermissionOperationType.CUSTOM],
      auditRequired:
        riskLevel === PermissionRiskLevel.HIGH ||
        riskLevel === PermissionRiskLevel.CRITICAL,
      ...options,
    };
  }

  /**
   * Create bulk operation permission metadata
   */
  static createBulkMeta(
    resource: string,
    operation: string,
    overrides: Partial<BasePermissionMeta> = {},
  ): BasePermissionMeta {
    return {
      description: `Execute bulk ${operation} operations on ${resource}`,
      riskLevel: PermissionRiskLevel.HIGH,
      requiresJustification: true,
      auditRequired: true,
      policyPath: `${resource}.bulk.${operation}`,
      action: `${resource}:bulk:${operation}`,
      operationType: PermissionOperationType.BULK,
      tags: [PermissionOperationType.BULK, operation],
      ...overrides,
    };
  }

  /**
   * Create sensitive data access permission metadata
   */
  static createSensitiveDataMeta(
    resource: string,
    dataType: string,
    overrides: Partial<BasePermissionMeta> = {},
  ): BasePermissionMeta {
    return {
      description: `Access sensitive ${dataType} data for ${resource}`,
      riskLevel: PermissionRiskLevel.CRITICAL,
      requiresJustification: true,
      auditRequired: true,
      policyPath: `${resource}.sensitive.${dataType}`,
      action: `${resource}:sensitive:${dataType}`,
      operationType: PermissionOperationType.SENSITIVE,
      tags: [PermissionOperationType.SENSITIVE, dataType],
      ...overrides,
    };
  }

  /**
   * Create admin operation permission metadata
   */
  static createAdminMeta(
    resource: string,
    operation: string,
    overrides: Partial<BasePermissionMeta> = {},
  ): BasePermissionMeta {
    return {
      description: `Administrative ${operation} operations on ${resource}`,
      riskLevel: PermissionRiskLevel.CRITICAL,
      requiresJustification: true,
      auditRequired: true,
      policyPath: `${resource}.admin.${operation}`,
      action: `${resource}:admin:${operation}`,
      operationType: PermissionOperationType.ADMIN,
      tags: [PermissionOperationType.ADMIN, 'high-risk', operation],
      category: 'Administration',
      ...overrides,
    };
  }
}
