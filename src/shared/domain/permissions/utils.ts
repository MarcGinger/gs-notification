/**
 * Shared Permission Utilities
 *
 * Framework-agnostic utilities for permission registry management,
 * role hierarchy handling, and OPA input building.
 *
 * These utilities provide type-safe, reusable patterns for implementing
 * permissions across different domain contexts.
 */

import type {
  BasePermissionMeta,
  PermissionRiskLevel,
  PermissionOperationType,
} from './base-permission.types';

// ===== Core Types =====

/**
 * Permission Registry - Maps permission enums to metadata
 */
export type PermissionRegistry<P extends string> = Readonly<
  Record<P, BasePermissionMeta>
>;

/**
 * Role Hierarchy - Maps role names to permission arrays
 */
export type RoleHierarchy<
  P extends string,
  R extends string = string,
> = Readonly<Record<R, readonly P[]>>;

/**
 * Authorization Actor - Standard subject information
 */
export interface AuthorizationActor {
  readonly userId: string;
  readonly tenantId?: string;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
}

/**
 * Authorization Resource - Standard resource information
 */
export interface AuthorizationResource {
  readonly type?: string;
  readonly id?: string;
  readonly ownerId?: string;
  readonly attrs?: Record<string, unknown>;
}

/**
 * Authorization Context - Request context information
 */
export interface AuthorizationContext {
  readonly correlationId: string;
  readonly timestamp?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

// ===== Registry Management =====

/**
 * Create a frozen permission registry with validation
 */
export function createPermissionRegistry<
  P extends string,
  R extends PermissionRegistry<P>,
>(registry: R): Readonly<R> {
  // Validate that all values are proper BasePermissionMeta
  for (const [key, meta] of Object.entries(registry)) {
    if (!meta || typeof meta !== 'object') {
      throw new Error(`Invalid permission metadata for ${key}`);
    }
    const typedMeta = meta as BasePermissionMeta;
    if (!typedMeta.description || !typedMeta.riskLevel) {
      throw new Error(`Missing required metadata fields for ${key}`);
    }
  }

  return Object.freeze(registry);
}

/**
 * Create a frozen role hierarchy with validation
 */
export function createRoleHierarchy<
  P extends string,
  RH extends RoleHierarchy<P, any>,
>(hierarchy: RH): Readonly<RH> {
  // Validate that all values are arrays
  for (const [role, permissions] of Object.entries(hierarchy)) {
    if (!Array.isArray(permissions)) {
      throw new Error(`Role ${role} must have an array of permissions`);
    }
  }

  return Object.freeze(hierarchy);
}

/**
 * Assert that permission registry is complete for given enum values
 */
export function assertRegistryComplete<P extends string>(
  allPermissions: readonly P[],
  registry: PermissionRegistry<P>,
): void {
  const registryKeys = Object.keys(registry) as P[];
  const missing = allPermissions.filter((p) => !registryKeys.includes(p));

  if (missing.length > 0) {
    throw new Error(
      `PermissionRegistry incomplete. Missing: ${missing.join(', ')}`,
    );
  }

  // Also check for extra keys in registry
  const extra = registryKeys.filter((k) => !allPermissions.includes(k));
  if (extra.length > 0) {
    throw new Error(
      `PermissionRegistry has unexpected permissions: ${extra.join(', ')}`,
    );
  }
}

// ===== Permission Expansion =====

/**
 * Expand permissions by including related permissions
 */
export function expandRelated<P extends string>(
  registry: PermissionRegistry<P>,
  seedPermissions: readonly P[],
  maxDepth: number = 3,
): P[] {
  const expanded = new Set<P>(seedPermissions);
  const processed = new Set<P>();

  let currentDepth = 0;
  let toProcess = [...seedPermissions];

  while (toProcess.length > 0 && currentDepth < maxDepth) {
    const nextToProcess: P[] = [];

    for (const permission of toProcess) {
      if (processed.has(permission)) continue;
      processed.add(permission);

      const meta = registry[permission];
      const related = (meta?.relatedPermissions as P[]) || [];

      for (const relatedPermission of related) {
        if (!expanded.has(relatedPermission)) {
          expanded.add(relatedPermission);
          nextToProcess.push(relatedPermission);
        }
      }
    }

    toProcess = nextToProcess;
    currentDepth++;
  }

  return Array.from(expanded);
}

/**
 * Get all permissions for a role, including inherited permissions
 */
export function getRolePermissions<P extends string, R extends string>(
  hierarchy: RoleHierarchy<P, R>,
  role: R,
): P[] {
  const permissions = hierarchy[role];
  return permissions ? [...permissions] : [];
}

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission<P extends string, R extends string>(
  hierarchy: RoleHierarchy<P, R>,
  role: R,
  permission: P,
): boolean {
  const permissions = hierarchy[role];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Get effective permissions for an actor based on their roles
 */
export function getEffectivePermissions<P extends string, R extends string>(
  hierarchy: RoleHierarchy<P, R>,
  registry: PermissionRegistry<P>,
  actor: AuthorizationActor,
  includeRelated: boolean = true,
): P[] {
  const rolePermissions = new Set<P>();

  // Add permissions from roles
  if (actor.roles) {
    for (const role of actor.roles) {
      const perms = getRolePermissions(hierarchy, role as R);
      perms.forEach((p) => rolePermissions.add(p));
    }
  }

  // Add direct permissions
  if (actor.permissions) {
    (actor.permissions as P[]).forEach((p) => rolePermissions.add(p));
  }

  const basePermissions = Array.from(rolePermissions);

  // Expand with related permissions if requested
  return includeRelated
    ? expandRelated(registry, basePermissions)
    : basePermissions;
}

// ===== Query Utilities =====

/**
 * Get permissions by risk level
 */
export function getPermissionsByRiskLevel<P extends string>(
  registry: PermissionRegistry<P>,
  riskLevel: PermissionRiskLevel,
): P[] {
  return Object.entries(registry)
    .filter(([, meta]) => (meta as BasePermissionMeta).riskLevel === riskLevel)
    .map(([permission]) => permission as P);
}

/**
 * Get permissions by operation type
 */
export function getPermissionsByOperationType<P extends string>(
  registry: PermissionRegistry<P>,
  operationType: PermissionOperationType,
): P[] {
  return Object.entries(registry)
    .filter(
      ([, meta]) =>
        (meta as BasePermissionMeta).operationType === operationType,
    )
    .map(([permission]) => permission as P);
}

/**
 * Get permissions that require justification
 */
export function getJustificationRequiredPermissions<P extends string>(
  registry: PermissionRegistry<P>,
): P[] {
  return Object.entries(registry)
    .filter(
      ([, meta]) => (meta as BasePermissionMeta).requiresJustification === true,
    )
    .map(([permission]) => permission as P);
}

/**
 * Get permissions that require audit logging
 */
export function getAuditRequiredPermissions<P extends string>(
  registry: PermissionRegistry<P>,
): P[] {
  return Object.entries(registry)
    .filter(([, meta]) => (meta as BasePermissionMeta).auditRequired === true)
    .map(([permission]) => permission as P);
}

/**
 * Get permissions by tags
 */
export function getPermissionsByTags<P extends string>(
  registry: PermissionRegistry<P>,
  tags: readonly string[],
): P[] {
  return Object.entries(registry)
    .filter(([, meta]) => {
      const metaTags = (meta as BasePermissionMeta).tags || [];
      return tags.some((tag) => metaTags.includes(tag));
    })
    .map(([permission]) => permission as P);
}

// ===== OPA Input Building =====

/**
 * Build OPA input structure from authorization request components
 */
export function buildOpaInput<P extends string>(args: {
  permissions: readonly P[];
  domain: string;
  actor: AuthorizationActor;
  resource?: AuthorizationResource;
  context: AuthorizationContext;
  registry: PermissionRegistry<P>;
}): {
  subject: {
    id: string;
    tenant?: string;
    roles: readonly string[];
    permissions?: readonly string[];
  };
  action: {
    type: string;
    name: string;
    riskLevel?: PermissionRiskLevel;
    operationType?: PermissionOperationType;
  };
  resource: {
    type: string;
    tenant?: string;
    id?: string;
    ownerId?: string;
    attributes?: Record<string, unknown>;
  };
  context: {
    correlationId: string;
    time: string;
    ipAddress?: string;
    userAgent?: string;
  };
} {
  const primaryPermission = args.permissions[0];
  const meta = args.registry[primaryPermission];

  return {
    subject: {
      id: args.actor.userId,
      tenant: args.actor.tenantId,
      roles: args.actor.roles || [],
      permissions: args.actor.permissions,
    },
    action: {
      type: extractActionType(primaryPermission),
      name: primaryPermission,
      riskLevel: meta?.riskLevel,
      operationType: meta?.operationType,
    },
    resource: {
      type: args.domain,
      tenant: args.actor.tenantId,
      id: args.resource?.id,
      ownerId: args.resource?.ownerId,
      attributes: args.resource?.attrs,
    },
    context: {
      correlationId: args.context.correlationId,
      time: args.context.timestamp || new Date().toISOString(),
      ipAddress: args.context.ipAddress,
      userAgent: args.context.userAgent,
    },
  };
}

/**
 * Extract action type from permission name
 * e.g., 'DOMAIN_PRODUCT_CREATE' -> 'create'
 */
export function extractActionType(permission: string): string {
  const parts = permission.split('_');
  if (parts.length >= 2) {
    const lastPart = parts[parts.length - 1].toLowerCase();
    // Map common patterns
    const actionMap: Record<string, string> = {
      create: 'create',
      read: 'read',
      update: 'update',
      delete: 'delete',
      admin: 'admin',
      import: 'bulk',
      export: 'bulk',
      audit: 'sensitive',
    };
    return actionMap[lastPart] || lastPart;
  }
  return 'custom';
}

// ===== Field-Level Permission Utilities =====

/**
 * Derive required permissions from changed fields using a field permission matrix
 */
export function deriveFieldPermissions<P extends string>(
  fieldMatrix: Record<string, readonly P[]>,
  changedFields: readonly string[],
): P[] {
  const requiredPermissions = new Set<P>();

  for (const field of changedFields) {
    const fieldPerms = fieldMatrix[field] || [];
    fieldPerms.forEach((perm) => requiredPermissions.add(perm));
  }

  return Array.from(requiredPermissions);
}

/**
 * Check if an update patch requires additional permissions beyond the base permission
 */
export function requiresAdditionalPermissions<P extends string>(
  fieldMatrix: Record<string, readonly P[]>,
  changedFields: readonly string[],
  basePermissions: readonly P[],
): { required: P[]; additional: P[] } {
  const required = deriveFieldPermissions(fieldMatrix, changedFields);
  const baseSet = new Set(basePermissions);
  const additional = required.filter((perm) => !baseSet.has(perm));

  return { required, additional };
}

// ===== Validation Utilities =====

/**
 * Validate permission registry integrity
 */
export function validateRegistryIntegrity<P extends string>(
  registry: PermissionRegistry<P>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const [permission, meta] of Object.entries(registry)) {
    const typedMeta = meta as BasePermissionMeta;
    if (!typedMeta.description) {
      errors.push(`${permission}: Missing description`);
    }
    if (!typedMeta.riskLevel) {
      errors.push(`${permission}: Missing riskLevel`);
    }
    if (typedMeta.relatedPermissions) {
      for (const related of typedMeta.relatedPermissions) {
        if (!(related in registry)) {
          errors.push(
            `${permission}: Related permission '${related}' not found in registry`,
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check for circular dependencies in related permissions
 */
export function checkCircularDependencies<P extends string>(
  registry: PermissionRegistry<P>,
): { hasCircularDeps: boolean; cycles: P[][] } {
  const cycles: P[][] = [];
  const visited = new Set<P>();
  const recursionStack = new Set<P>();

  function dfs(permission: P, path: P[]): boolean {
    if (recursionStack.has(permission)) {
      // Found a cycle
      const cycleStart = path.indexOf(permission);
      cycles.push(path.slice(cycleStart).concat(permission));
      return true;
    }

    if (visited.has(permission)) {
      return false;
    }

    visited.add(permission);
    recursionStack.add(permission);

    const meta = registry[permission];
    const related = (meta?.relatedPermissions as P[]) || [];

    let foundCycle = false;
    for (const relatedPerm of related) {
      if (dfs(relatedPerm, [...path, permission])) {
        foundCycle = true;
      }
    }

    recursionStack.delete(permission);
    return foundCycle;
  }

  for (const permission of Object.keys(registry) as P[]) {
    if (!visited.has(permission)) {
      dfs(permission, []);
    }
  }

  return {
    hasCircularDeps: cycles.length > 0,
    cycles,
  };
}

// ===== Index Utilities =====

/**
 * Index permissions by risk level for efficient queries
 */
export function indexByRisk<P extends string>(
  registry: PermissionRegistry<P>,
): Record<PermissionRiskLevel, P[]> {
  const index = {
    LOW: [] as P[],
    MEDIUM: [] as P[],
    HIGH: [] as P[],
    CRITICAL: [] as P[],
  };

  for (const [permission, meta] of Object.entries(registry) as [
    P,
    BasePermissionMeta,
  ][]) {
    index[meta.riskLevel].push(permission);
  }

  return index;
}

/**
 * Index permissions by operation type for efficient queries
 */
export function indexByOperation<P extends string>(
  registry: PermissionRegistry<P>,
): Record<PermissionOperationType, P[]> {
  const index = {
    crud: [] as P[],
    bulk: [] as P[],
    admin: [] as P[],
    sensitive: [] as P[],
    custom: [] as P[],
  };

  for (const [permission, meta] of Object.entries(registry) as [
    P,
    BasePermissionMeta,
  ][]) {
    if (meta.operationType) {
      index[meta.operationType].push(permission);
    }
  }

  return index;
}
