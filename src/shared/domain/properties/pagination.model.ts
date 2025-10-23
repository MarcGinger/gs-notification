import {
  Result,
  ok,
  err,
  DomainError,
  makeCatalog,
  withContext,
} from '../../errors';

// Sorting (either enum or string union; union is lighter)
export type SortOrder = 'asc' | 'desc';
// If you prefer an enum:
// export enum SortOrder { Asc = 'asc', Desc = 'desc' }

// Sort map: field -> order
export type SortBy = Record<string, SortOrder>;

// Request options (page-based)
export interface ListOptions {
  page?: number; // 1-based
  size?: number; // items per page
  sortBy?: SortBy; // e.g. { createdAt: 'desc', name: 'asc' }
}

// ✅ Enhanced meta with optional totalItems for expensive counts
export interface ListMeta {
  page: number; // current page (1-based)
  size: number;
  totalItems?: number; // Optional - expensive to compute at scale
  totalPages?: number; // Present only if totalItems is present
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

// ✅ Response wrapper with Result integration
export interface ListResponse<T> {
  data: readonly T[];
  meta: Readonly<ListMeta>;
}

// ✅ Result-wrapped pagination response for type-safe error handling
export type PaginatedResult<T> = Result<ListResponse<T>, DomainError>;

// ✅ Enhanced pagination errors with proper context
export const PaginationErrors = makeCatalog(
  {
    INVALID_PAGE_NUMBER: {
      title: 'Page number must be greater than 0',
      category: 'validation' as const,
    },
    INVALID_PAGE_SIZE: {
      title: 'Page size must be between 1 and configured maximum',
      category: 'validation' as const,
    },
    CURSOR_DECODE_ERROR: {
      title: 'Invalid cursor format',
      category: 'validation' as const,
    },
    SORT_FIELD_NOT_ALLOWED: {
      title: 'Sort field is not in the allowed list',
      category: 'validation' as const,
    },
    TOTAL_COUNT_COMPUTATION_FAILED: {
      title: 'Failed to compute total count',
      category: 'infrastructure' as const,
      retryable: true,
    },
  },
  'PAGINATION',
);

// ✅ Enhanced helper with Result pattern and validation
export function makeListMeta(
  totalItems: number | undefined,
  opts: { page?: number; size?: number; maxSize?: number } = {},
): Result<ListMeta, DomainError> {
  const { page = 1, size = 20, maxSize = 100 } = opts;

  // ✅ Input validation with proper error handling
  if (page < 1) {
    return err(
      withContext(PaginationErrors.INVALID_PAGE_NUMBER, {
        page,
      }),
    );
  }

  if (size < 1 || size > maxSize) {
    return err(
      withContext(PaginationErrors.INVALID_PAGE_SIZE, {
        size,
        maxSize,
      }),
    );
  }

  const safeSize = Math.max(1, Math.min(maxSize, size));

  // ✅ Handle unknown total count scenario (for expensive operations)
  if (totalItems === undefined) {
    return ok({
      page: Math.max(1, page),
      size: safeSize,
      hasPreviousPage: page > 1,
      hasNextPage: true, // Unknown if there are more items
    });
  }

  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return ok({
    page: safePage,
    size: safeSize,
    totalItems,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  });
}

// ✅ Enhanced convenience creator with Result pattern
export function makeListResponse<T>(
  items: T[],
  totalItems: number | undefined,
  options?: { page?: number; size?: number; maxSize?: number },
): PaginatedResult<T> {
  const metaResult = makeListMeta(totalItems, options);

  if (!metaResult.ok) {
    return err(
      withContext(metaResult.error, {
        itemCount: items.length,
        operation: 'make_list_response',
      }),
    );
  }

  return ok({
    data: items,
    meta: metaResult.value,
  });
}

// ✅ Enhanced toTakeSkip with validation
export function toTakeSkip(
  page = 1,
  size = 20,
  maxSize = 100,
): Result<{ take: number; skip: number }, DomainError> {
  if (page < 1) {
    return err(
      withContext(PaginationErrors.INVALID_PAGE_NUMBER, {
        page,
      }),
    );
  }

  if (size < 1 || size > maxSize) {
    return err(
      withContext(PaginationErrors.INVALID_PAGE_SIZE, {
        size,
        maxSize,
      }),
    );
  }

  const safeSize = Math.max(1, Math.min(maxSize, size));
  const safePage = Math.max(1, page);
  const take = safeSize;
  const skip = (safePage - 1) * safeSize;

  return ok({ take, skip });
}

// ✅ Enhanced cursor pagination types
export interface CursorPageOptions {
  after?: string;
  before?: string; // For backward navigation
  limit?: number;
}

export interface CursorMeta {
  nextCursor?: string;
  prevCursor?: string; // For backward navigation
  limit: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CursorListResponse<T> {
  data: readonly T[];
  meta: Readonly<CursorMeta>;
}

// ✅ Result-wrapped cursor response
export type CursorPaginatedResult<T> = Result<
  CursorListResponse<T>,
  DomainError
>;

// ✅ Sort field validation helper
export function validateSortFields(
  sortBy: SortBy | undefined,
  allowedFields: readonly string[],
): Result<Record<string, 'ASC' | 'DESC'>, DomainError> {
  if (!sortBy || Object.keys(sortBy).length === 0) {
    return ok({}); // No sorting specified
  }

  const invalidFields = Object.keys(sortBy).filter(
    (field) => !allowedFields.includes(field),
  );

  if (invalidFields.length > 0) {
    return err(
      withContext(PaginationErrors.SORT_FIELD_NOT_ALLOWED, {
        field: invalidFields[0],
        invalidFields,
        allowedFields: allowedFields.slice(), // Convert readonly to regular array
      }),
    );
  }

  // ✅ Convert to TypeORM/database format
  const orderBy = Object.entries(sortBy).reduce(
    (acc, [field, direction]) => {
      acc[field] = direction.toUpperCase() as 'ASC' | 'DESC';
      return acc;
    },
    {} as Record<string, 'ASC' | 'DESC'>,
  );

  return ok(orderBy);
}

// ✅ PII-safe pagination context for logging
export interface PaginationLogContext {
  page?: number;
  size?: number;
  sortFields: readonly string[]; // ✅ Field names only, no values
  filterCount: number; // ✅ Count only, no filter values
  operation: string;
  correlationId?: string;
  userId?: string;
}

// ✅ Helper to create PII-safe log context
export function createPaginationLogContext(
  filters: Record<string, unknown> = {},
  operation: string,
  meta?: { correlationId?: string; userId?: string },
): PaginationLogContext {
  return {
    page: typeof filters.page === 'number' ? filters.page : undefined,
    size: typeof filters.size === 'number' ? filters.size : undefined,
    sortFields: Object.keys(filters.sortBy || {}),
    filterCount: Object.keys(filters).length,
    operation,
    correlationId: meta?.correlationId,
    userId: meta?.userId,
  };
}

// ✅ Backward compatibility - simple functions without Result wrapping
// These maintain the original API for gradual migration

export function makeListMeta_Simple(
  totalItems: number,
  opts: { page?: number; size?: number } = {},
): ListMeta {
  const size = Math.max(1, Math.min(100, opts.size ?? 20)); // clamp to sane bounds
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const page = Math.min(Math.max(1, opts.page ?? 1), totalPages);

  return {
    page,
    size,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

export function makeListResponse_Simple<T>(
  items: T[],
  totalItems: number,
  options?: { page?: number; size?: number },
): ListResponse<T> {
  return {
    data: items,
    meta: makeListMeta_Simple(totalItems, options),
  };
}

export function toTakeSkip_Simple(page = 1, size = 20) {
  const safeSize = Math.max(1, size);
  const safePage = Math.max(1, page);
  const take = safeSize;
  const skip = (safePage - 1) * safeSize;
  return { take, skip };
}
