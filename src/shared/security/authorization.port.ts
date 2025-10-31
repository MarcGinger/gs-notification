/**
 * Authorization Port Interface
 *
 * Generic authorization abstraction that can be implemented by different
 * authorization services (OPA, RBAC, etc.). Provides type-safe, domain-aware
 * permission checking with comprehensive context support.
 */

import type { Result } from '../errors/error.types';
import type { DomainError } from '../errors/error.types';
import type { PermissionTenantScope } from '../domain/permissions/base-permission.types';

// ===== Authorization Request Types =====

/**
 * Actor (subject) performing the action
 */
export interface AuthorizationActor {
  readonly userId: string;
  readonly tenant?: string;
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Resource being accessed
 */
export interface AuthorizationResource {
  readonly type?: string;
  readonly id?: string;
  readonly ownerId?: string;
  readonly tenant?: string;
  readonly attrs?: Record<string, unknown>;
}

/**
 * Context of the authorization request
 */
export interface AuthorizationContext {
  readonly correlationId: string;
  readonly timestamp?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly environment?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Complete authorization request
 */
export interface AuthorizationRequest<P extends string> {
  readonly domain: string;
  readonly permissions: readonly P[];
  readonly anyOf?: boolean; // If true, only one permission needs to be granted
  readonly actor: AuthorizationActor;
  readonly resource?: AuthorizationResource;
  readonly context?: AuthorizationContext;
  readonly tenantScope?: PermissionTenantScope;
}

// ===== Authorization Response Types =====

/**
 * Obligation returned with authorization decision
 */
export interface AuthorizationObligation {
  readonly type: 'mask' | 'redact' | 'limit' | 'audit' | 'approval' | 'custom';
  readonly fields?: readonly string[];
  readonly count?: number;
  readonly level?: string;
  readonly required?: boolean;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Authorization decision result
 */
export interface AuthorizationResult {
  readonly allowed: boolean;
  readonly reason?: string;
  readonly obligations?: readonly AuthorizationObligation[];
  readonly metadata?: Record<string, unknown>;
}

// ===== Authorization Port Interface =====

/**
 * Generic authorization port for type-safe permission checking
 *
 * This interface abstracts authorization logic and can be implemented by:
 * - OPA-based authorization services
 * - RBAC authorization services
 * - Mock/stub services for testing
 * - Composite authorization services
 */
export interface AuthorizationPort<P extends string> {
  /**
   * Check if an actor is authorized to perform specific permissions on a resource
   *
   * @param request - Complete authorization request with actor, permissions, resource, context
   * @returns Promise<Result<AuthorizationResult, DomainError>> - Authorization decision with obligations
   */
  check(
    request: AuthorizationRequest<P>,
  ): Promise<Result<AuthorizationResult, DomainError>>;

  /**
   * Batch check multiple authorization requests
   *
   * @param requests - Array of authorization requests
   * @returns Promise<Result<AuthorizationResult[], DomainError>> - Array of authorization decisions
   */
  checkBatch?(
    requests: readonly AuthorizationRequest<P>[],
  ): Promise<Result<readonly AuthorizationResult[], DomainError>>;

  /**
   * Get effective permissions for an actor in a given context
   *
   * @param actor - Actor to get permissions for
   * @param domain - Domain context for permissions
   * @param context - Request context
   * @returns Promise<Result<P[], DomainError>> - List of effective permissions
   */
  getEffectivePermissions?(
    actor: AuthorizationActor,
    domain: string,
    context?: AuthorizationContext,
  ): Promise<Result<readonly P[], DomainError>>;
}

// ===== Authorization Utilities =====

/**
 * Build authorization context from common request data
 */
export function buildAuthorizationContext(
  correlationId: string,
  options?: {
    timestamp?: string;
    ipAddress?: string;
    userAgent?: string;
    environment?: string;
    metadata?: Record<string, unknown>;
  },
): AuthorizationContext {
  return {
    correlationId,
    timestamp: options?.timestamp || new Date().toISOString(),
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
    environment: options?.environment,
    metadata: options?.metadata,
  };
}

/**
 * Build authorization actor from user token and context
 */
export function buildAuthorizationActor(
  userId: string,
  options?: {
    tenant?: string;
    roles?: readonly string[];
    permissions?: readonly string[];
    metadata?: Record<string, unknown>;
  },
): AuthorizationActor {
  return {
    userId,
    tenant: options?.tenant,
    roles: options?.roles,
    permissions: options?.permissions,
    metadata: options?.metadata,
  };
}

/**
 * Build authorization resource from domain and entity data
 */
export function buildAuthorizationResource(
  type: string,
  options?: {
    id?: string;
    ownerId?: string;
    tenant?: string;
    attrs?: Record<string, unknown>;
  },
): AuthorizationResource {
  return {
    type,
    id: options?.id,
    ownerId: options?.ownerId,
    tenant: options?.tenant,
    attrs: options?.attrs,
  };
}

/**
 * Build complete authorization request
 */
export function buildAuthorizationRequest<P extends string>(
  domain: string,
  permissions: readonly P[],
  actor: AuthorizationActor,
  options?: {
    resource?: AuthorizationResource;
    context?: AuthorizationContext;
    anyOf?: boolean;
    tenantScope?: PermissionTenantScope;
  },
): AuthorizationRequest<P> {
  return {
    domain,
    permissions,
    actor,
    anyOf: options?.anyOf,
    resource: options?.resource,
    context: options?.context,
    tenantScope: options?.tenantScope,
  };
}

// ===== Authorization Decorators & Metadata =====

/**
 * Metadata key for authorization decorators
 */
export const AUTHORIZATION_METADATA_KEY = 'authorization';

/**
 * Authorization metadata for controllers/handlers
 */
export interface AuthorizationMetadata<P extends string> {
  readonly domain: string;
  readonly permissions: readonly P[];
  readonly anyOf?: boolean;
  readonly skipAuthorization?: boolean;
  readonly resourceExtractor?: (
    req: any,
  ) => AuthorizationResource | Promise<AuthorizationResource>;
}

/**
 * Check if authorization decision allows access
 */
export function isAuthorized(result: AuthorizationResult): boolean {
  return result.allowed;
}

/**
 * Extract obligations of a specific type from authorization result
 */
export function getObligations(
  result: AuthorizationResult,
  type: AuthorizationObligation['type'],
): readonly AuthorizationObligation[] {
  return (
    result.obligations?.filter((obligation) => obligation.type === type) || []
  );
}

/**
 * Check if authorization result has specific obligation type
 */
export function hasObligation(
  result: AuthorizationResult,
  type: AuthorizationObligation['type'],
): boolean {
  return getObligations(result, type).length > 0;
}

// ===== Authorization Errors =====

/**
 * Common authorization error codes
 */
export const AuthorizationErrors = {
  PERMISSION_DENIED: 'AUTHORIZATION.PERMISSION_DENIED',
  INVALID_ACTOR: 'AUTHORIZATION.INVALID_ACTOR',
  INVALID_RESOURCE: 'AUTHORIZATION.INVALID_RESOURCE',
  SERVICE_UNAVAILABLE: 'AUTHORIZATION.SERVICE_UNAVAILABLE',
  CONFIGURATION_ERROR: 'AUTHORIZATION.CONFIGURATION_ERROR',
  TIMEOUT: 'AUTHORIZATION.TIMEOUT',
} as const;

/**
 * Create a permission denied error
 */
export function createPermissionDeniedError(
  domain: string,
  permissions: readonly string[],
  reason?: string,
  context?: Record<string, unknown>,
): DomainError {
  return {
    code: AuthorizationErrors.PERMISSION_DENIED,
    title: 'Permission denied',
    detail: reason || `Missing required permissions: ${permissions.join(', ')}`,
    category: 'security' as const,
    context: {
      domain,
      permissions,
      reason,
      ...context,
    },
  };
}

/**
 * Create a service unavailable error
 */
export function createServiceUnavailableError(
  reason?: string,
  context?: Record<string, unknown>,
): DomainError {
  return {
    code: AuthorizationErrors.SERVICE_UNAVAILABLE,
    title: 'Authorization service unavailable',
    detail: reason || 'Authorization service is temporarily unavailable',
    category: 'infrastructure' as const,
    retryable: true,
    context,
  };
}
