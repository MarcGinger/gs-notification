import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiExtraModels } from '@nestjs/swagger';
import {
  IsArray,
  ValidateNested,
  ArrayNotEmpty,
  IsOptional,
} from 'class-validator';
import { Type as TransformType } from 'class-transformer';

type Class<T = any> = new (...args: any[]) => T;

export function ApiListOf<T>(
  ItemDto: Class<T>,
  opts: { required?: boolean; nonEmpty?: boolean } = {},
): PropertyDecorator {
  const { required = true, nonEmpty = false } = opts;

  return applyDecorators(
    ApiExtraModels(ItemDto), // ensure model is registered with swagger
    ApiProperty({
      description: `Array of ${ItemDto.name} items`,
      type: () => ItemDto,
      isArray: true,
      required,
    }),
    IsArray(),
    ValidateNested({ each: true }),
    TransformType(() => ItemDto),
    nonEmpty ? ArrayNotEmpty() : IsOptional(), // choose one based on requiredness
  );
}
