import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';

/**
 * Property decorator for Created Date with required option
 * @param {Object} options - Options for the decorator
 * @returns {PropertyDecorator}
 */
export function ApiPaginationPage(options: { required?: boolean } = {}) {
  const { required = true } = options;

  return applyDecorators(
    ApiProperty({
      description: 'Page number (1-based)',
      example: 1,
      minimum: 1,
      required,
      default: 1,
      type: 'integer',
    }),
    IsInt(),
    Min(1),
    Type(() => Number),
    required ? IsNotEmpty() : IsOptional(),
  );
}
