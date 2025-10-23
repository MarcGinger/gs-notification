/**
 * Generic paginated list request DTO with configurable sort fields
 * This base class provides common pagination and sorting functionality
 * that can be extended by domain-specific DTOs
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, ValidateIf } from 'class-validator';
import { PaginationMetaResponse } from 'src/shared/application/dtos';
import { ListOptions } from 'src/shared/domain/properties';
import { DEFAULT_PAGINATION_CONFIG } from 'src/shared/domain/pagination.config';

/**
 * Base filter request with common pagination properties
 * Extended by domain-specific filter requests to add sorting and filtering
 */
export abstract class BaseListFilterRequest implements ListOptions {
  @ApiPropertyOptional({
    minimum: 1,
    description: 'Page number (1-based indexing)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: DEFAULT_PAGINATION_CONFIG.maxPageSize,
    description: 'Number of items per page',
    example: DEFAULT_PAGINATION_CONFIG.defaultPageSize,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(DEFAULT_PAGINATION_CONFIG.maxPageSize)
  size?: number;
}

/**
 * Generic paginated response wrapper
 * Can be used with any data type for consistent API responses
 */
export class PagedResponse<TData> {
  readonly data: TData[];
  readonly meta: PaginationMetaResponse;

  constructor(data: TData[], meta: PaginationMetaResponse) {
    this.data = data;
    this.meta = meta;
  }
}

/**
 * Sort field configuration for type-safe sorting
 */
export interface SortFieldConfig {
  [fieldName: string]: {
    /** Human-readable description for API docs */
    description: string;
    /** Whether this field allows sorting */
    sortable: boolean;
    /** Default sort direction if not specified */
    defaultDirection?: 'asc' | 'desc';
  };
}

/**
 * Generic sortable list filter with configurable sort fields
 * Provides type-safe sorting for any entity
 */
export abstract class BaseSortableListFilterRequest extends BaseListFilterRequest {
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: {
      type: 'string',
      enum: ['asc', 'desc'],
    },
    description: 'Sort criteria with field names and directions',
  })
  @IsOptional()
  @ValidateIf(
    (o: BaseSortableListFilterRequest) => typeof o.sortBy === 'object',
  )
  sortBy?: Record<string, 'asc' | 'desc'>;

  /**
   * Subclasses should implement this to define available sort fields
   */
  abstract getSortFieldConfig(): SortFieldConfig;

  /**
   * Validate that only allowed sort fields are used
   */
  validateSortFields(): boolean {
    if (!this.sortBy) return true;

    const config = this.getSortFieldConfig();
    const allowedFields = Object.keys(config).filter(
      (field) => config[field].sortable,
    );

    const requestedFields = Object.keys(this.sortBy);
    return requestedFields.every((field) => allowedFields.includes(field));
  }
}
