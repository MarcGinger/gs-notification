/**
 * Enhanced Pagination Application DTOs
 * Bridges external class-validator patterns with our Result-based domain model
 */

import { ApiProperty } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';

import { Result, DomainError } from '../../errors';
import {
  ListOptions,
  ListResponse,
  makeListResponse,
} from '../../domain/properties/pagination.model';
import { ApiPaginationPage, ApiPaginationSize } from '../decorators';

// ✅ Enhanced sort order enum for API documentation
export enum ApiSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * ✅ Application DTO for pagination requests with full validation and documentation
 */
export class PaginationRequest {
  @ApiPaginationPage()
  readonly page?: number = 1;

  @ApiPaginationSize()
  readonly size?: number = 20;

  /**
   * ✅ Convert to internal domain model for business logic
   */
  toDomainOptions(): ListOptions {
    return {
      page: this.page,
      size: this.size,
    };
  }
}

/**
 * ✅ Pagination metadata DTO for API responses
 */
export class PaginationMetaResponse {
  @ApiProperty({
    description: 'Current page number (1-based)',
    example: 1,
    type: 'integer',
  })
  readonly page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    type: 'integer',
  })
  readonly size: number;

  @ApiProperty({
    description: 'Total number of items (may be undefined for performance)',
    example: 150,
    required: false,
    type: 'integer',
  })
  readonly totalItems?: number;

  @ApiProperty({
    description:
      'Total number of pages (only present if totalItems is available)',
    example: 8,
    required: false,
    type: 'integer',
  })
  readonly totalPages?: number;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
    type: 'boolean',
  })
  readonly hasPreviousPage: boolean;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
    type: 'boolean',
  })
  readonly hasNextPage: boolean;

  constructor(meta: {
    page: number;
    size: number;
    totalItems?: number;
    totalPages?: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  }) {
    this.page = meta.page;
    this.size = meta.size;
    this.totalItems = meta.totalItems;
    this.totalPages = meta.totalPages;
    this.hasPreviousPage = meta.hasPreviousPage;
    this.hasNextPage = meta.hasNextPage;
  }
}

/**
 * ✅ Generic paginated response DTO that integrates with Result patterns
 */
export class PaginatedResponse<T> {
  @ApiProperty({
    description: 'Array of data items',
    type: 'array',
  })
  readonly data: readonly T[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: () => PaginationMetaResponse,
  })
  readonly meta: PaginationMetaResponse;

  constructor(result: Result<ListResponse<T>, DomainError>) {
    if (result.ok) {
      this.data = result.value.data;
      this.meta = new PaginationMetaResponse(result.value.meta);
    } else {
      // ✅ Convert domain errors to HTTP exceptions
      throw new BadRequestException({
        message: result.error.title,
        code: result.error.code,
        context: result.error.context,
      });
    }
  }

  /**
   * ✅ Static factory method for easier creation
   */
  static fromResult<T>(
    result: Result<ListResponse<T>, DomainError>,
  ): PaginatedResponse<T> {
    return new PaginatedResponse(result);
  }

  /**
   * ✅ Static factory method from domain data
   */
  static fromData<T>(
    items: T[],
    options: PaginationRequest,
    totalItems?: number,
  ): PaginatedResponse<T> {
    const domainOptions = options.toDomainOptions();
    const result = makeListResponse(items, totalItems, domainOptions);
    return new PaginatedResponse(result);
  }
}

/**
 * ✅ Application service for consistent pagination handling
 */
export class PaginationApplicationService {
  /**
   * Generic pagination handler that bridges DTO and domain layers
   */
  static async paginate<T>(
    dto: PaginationRequest,
    fetcher: (options: ListOptions) => Promise<Result<T[], DomainError>>,
    counter?: (options: ListOptions) => Promise<Result<number, DomainError>>,
  ): Promise<PaginatedResponse<T>> {
    // Convert to domain model
    const domainOptions = dto.toDomainOptions();

    // Fetch data using domain logic
    const dataResult = await fetcher(domainOptions);
    if (!dataResult.ok) {
      throw new BadRequestException({
        message: dataResult.error.title,
        code: dataResult.error.code,
        context: dataResult.error.context,
      });
    }

    // Get total count if counter is provided
    let totalItems: number | undefined;
    if (counter) {
      const countResult = await counter(domainOptions);
      if (countResult.ok) {
        totalItems = countResult.value;
      }
      // If count fails, we continue without it (for performance resilience)
    }

    // Create response using domain logic
    const responseResult = makeListResponse(
      dataResult.value,
      totalItems,
      domainOptions,
    );

    return new PaginatedResponse(responseResult);
  }
}
