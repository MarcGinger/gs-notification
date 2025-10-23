// api-common-errors.decorator.ts
import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiUnprocessableEntityResponse,
  ApiInternalServerErrorResponse,
  ApiExtraModels,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ProblemDetailsDto,
  ValidationProblemDetailsDto,
} from './problem-details.dto';

type Extra = { status: number; description?: string };

export function ApiCommonErrors(opts?: {
  include422?: boolean;
  extra?: Extra[];
}) {
  const content = (dto: string | (new (...args: any[]) => unknown)) => ({
    'application/problem+json': { schema: { $ref: getSchemaPath(dto) } },
  });

  return applyDecorators(
    ApiExtraModels(ProblemDetailsDto, ValidationProblemDetailsDto),

    ApiBadRequestResponse({
      description: 'Bad Request. Invalid input or business rule violation.',
      content: content(ProblemDetailsDto),
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized. Authentication required.',
      content: content(ProblemDetailsDto),
    }),
    ApiForbiddenResponse({
      description: 'Forbidden. Insufficient permissions.',
      content: content(ProblemDetailsDto),
    }),
    ApiNotFoundResponse({
      description: 'Not Found. Resource does not exist.',
      content: content(ProblemDetailsDto),
    }),
    ApiConflictResponse({
      description: 'Conflict. Resource already exists or state conflict.',
      content: content(ProblemDetailsDto),
    }),
    ...(opts?.include422
      ? [
          ApiUnprocessableEntityResponse({
            description: 'Validation failed.',
            content: content(ValidationProblemDetailsDto),
          }),
        ]
      : []),
    ApiInternalServerErrorResponse({
      description: 'Internal Server Error.',
      content: content(ProblemDetailsDto),
    }),

    ...(opts?.extra?.map((e) =>
      ApiResponse({
        status: e.status,
        description: e.description ?? 'Error',
        content: content(ProblemDetailsDto),
      }),
    ) ?? []),
  );
}
