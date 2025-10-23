// problem-details.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ProblemDetailsDto {
  @ApiProperty({
    example: 'https://errors.api.example.com/v1/conflict',
    required: false,
  })
  type?: string;

  @ApiProperty({ example: 'Conflict' })
  title!: string;

  @ApiProperty({ example: 409 })
  status!: number;

  @ApiProperty({ example: 'Cannot update deleted product', required: false })
  detail?: string;

  @ApiProperty({ example: '/products/123', required: false })
  instance?: string;

  // Extensions (non-standard but common)
  @ApiProperty({ example: 'BUSINESS_RULE_VIOLATION', required: false })
  code?: string;

  @ApiProperty({ example: 'c5a1d0f7a1bd4b0e9f5a2e9d2f3c4a1b', required: false })
  traceId?: string;

  @ApiProperty({ example: 'req-01J5Z3X9F6A3M97C5PZ5T4', required: false })
  correlationId?: string;
}

export class ValidationProblemDetailsDto extends ProblemDetailsDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'string' } },
    example: {
      name: ['must not be empty'],
      amount: ['must be greater than 0'],
    },
  })
  errors?: Record<string, string[]>;
}
