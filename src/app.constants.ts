/**
 * Application-level constants
 *
 * This file defines business-specific constants that are used throughout the application.
 * These are NOT shared infrastructure concerns, but rather business domain values.
 */

// ✨ Service-level business constants
export const SERVICE_METADATA = {
  name: 'gs-scaffold-dev',
  version: '0.0.1',
} as const;

// ✨ Bounded Context business constants
export const BOUNDED_CONTEXTS = {
  CATALOG: 'catalog',
  ORDER: 'order',
  USER: 'user',
  BILLING: 'billing',
} as const;

// ✨ Application business constants
export const CATALOG_APPLICATIONS = {
  PRODUCT: 'product',
  CATEGORY: 'category',
  INVENTORY: 'inventory',
} as const;

// ✨ Helper types for type safety
export type BoundedContext =
  (typeof BOUNDED_CONTEXTS)[keyof typeof BOUNDED_CONTEXTS];
export type CatalogApplication =
  (typeof CATALOG_APPLICATIONS)[keyof typeof CATALOG_APPLICATIONS];
