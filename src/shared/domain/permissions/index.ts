/**
 * Shared Domain Permissions
 *
 * Provides base interfaces, types, and utilities for implementing
 * permissions as code across different domain contexts
 */

// Export all base permission types and interfaces
export * from './base-permission.types';

// Re-export commonly used types for convenience
export type {
  BasePermissionMeta,
  BasePermissionRegistry,
  BasePermissionHierarchy,
} from './base-permission.types';

// Re-export values and utility classes
export {
  BasePermissionUtils,
  PermissionRiskLevel,
} from './base-permission.types';
