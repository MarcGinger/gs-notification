import { applyDecorators } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, Max, Min } from 'class-validator';

/**
 * Property decorator for Currency with required option
 * @param {Object} options - Options for the decorator
 * @returns {PropertyDecorator}
 */
export function ApiPaginationSize(options: { required?: boolean } = {}) {
  const { required = true } = options;

  const decorators = [
    ApiProperty({
      description: 'Number of items per page',
      example: 20,
      minimum: 1,
      maximum: 100,
      required: false,
      default: 20,
      type: 'integer',
    }),
    IsInt(),
    Min(1),
    Max(100),
    Type(() => Number),
  ];

  if (required) {
    decorators.push(IsNotEmpty());
  } else {
    decorators.push(IsOptional());
  }

  return applyDecorators(...decorators);
}
