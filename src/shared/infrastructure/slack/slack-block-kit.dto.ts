/**
 * Slack Block Kit DTO Definitions
 *
 * Data Transfer Objects for Slack Block Kit components with validation decorators
 * and Swagger documentation. These DTOs provide runtime validation and API
 * documentation for Block Kit message construction.
 *
 * @see https://api.slack.com/block-kit
 * @version 1.0.0
 */

import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsArray,
  IsObject,
  IsEnum,
  IsUrl,
  MinLength,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
} from 'class-validator';
import { Transform, Type as TransformType } from 'class-transformer';

/** ---------- Decorator Utilities ---------- */

/**
 * Options for property decorators
 */
interface PropOptions {
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  example?: string | object;
  description?: string;
}

/**
 * Creates a standardized property decorator for text fields
 */
function ApiTextProperty(options: PropOptions = {}) {
  const {
    required = false,
    maxLength,
    minLength,
    example,
    description = 'Text content',
  } = options;

  const decorators = [
    required
      ? ApiProperty({ description, example, type: String })
      : ApiPropertyOptional({ description, example, type: String }),
    IsString(),
    required ? IsNotEmpty() : IsOptional(),
  ];

  if (maxLength) decorators.push(MaxLength(maxLength));
  if (minLength) decorators.push(MinLength(minLength));

  return applyDecorators(...decorators);
}

/**
 * Creates a standardized property decorator for boolean fields
 */
function ApiBooleanProperty(
  description: string,
  required = false,
  example?: boolean,
) {
  return applyDecorators(
    required
      ? ApiProperty({ description, example, type: Boolean })
      : ApiPropertyOptional({ description, example, type: Boolean }),
    IsBoolean(),
    required ? IsNotEmpty() : IsOptional(),
  );
}

/**
 * Creates a standardized property decorator for enum fields
 */
function ApiEnumProperty<T extends Record<string, string | number>>(
  enumObject: T,
  description: string,
  required = false,
  example?: T[keyof T],
) {
  return applyDecorators(
    required
      ? ApiProperty({
          description,
          example,
          enum: Object.values(enumObject),
        })
      : ApiPropertyOptional({
          description,
          example,
          enum: Object.values(enumObject),
        }),
    IsEnum(enumObject),
    required ? IsNotEmpty() : IsOptional(),
  );
}

/** ---------- Base Text Objects ---------- */

/**
 * Plain text object DTO
 */
export class PlainTextDto {
  @ApiProperty({
    description: 'Text object type',
    example: 'plain_text',
    enum: ['plain_text'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['plain_text'])
  type = 'plain_text' as const;

  @ApiTextProperty({
    required: true,
    maxLength: 3000,
    description: 'Plain text content (no markdown)',
    example: 'Click me!',
  })
  text: string;

  @ApiBooleanProperty(
    'Whether to allow emoji shortcodes like :smile:',
    false,
    true,
  )
  emoji?: boolean;
}

/**
 * Markdown text object DTO
 */
export class MrkdwnTextDto {
  @ApiProperty({
    description: 'Text object type',
    example: 'mrkdwn',
    enum: ['mrkdwn'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['mrkdwn'])
  type = 'mrkdwn' as const;

  @ApiTextProperty({
    required: true,
    maxLength: 3000,
    description: 'Text content with markdown support',
    example: '*Bold text* and _italic text_',
  })
  text: string;

  @ApiBooleanProperty(
    'When true, disables formatting and treats text as literal',
    false,
    false,
  )
  verbatim?: boolean;
}

/** ---------- Composition Objects ---------- */

/**
 * Option object DTO for select menus
 */
export class SlackOptionDto {
  @ApiProperty({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  text: PlainTextDto;

  @ApiTextProperty({
    required: true,
    maxLength: 75,
    description: 'String value sent when selected',
    example: 'option_1',
  })
  value: string;

  @ApiPropertyOptional({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  @IsOptional()
  description?: PlainTextDto;

  @ApiPropertyOptional({
    description: 'URL to load in user browser when option is clicked',
    example: 'https://example.com',
  })
  @IsUrl()
  @IsOptional()
  url?: string;
}

/**
 * Option group DTO for organizing select options
 */
export class SlackOptionGroupDto {
  @ApiProperty({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  label: PlainTextDto;

  @ApiProperty({
    type: [SlackOptionDto],
    description: 'Options in this group (max 100)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @TransformType(() => SlackOptionDto)
  @ArrayMaxSize(100)
  @ArrayMinSize(1)
  options: SlackOptionDto[];
}

/**
 * Confirm dialog DTO for dangerous actions
 */
export class SlackConfirmDialogDto {
  @ApiProperty({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  title: PlainTextDto;

  @ApiProperty({
    oneOf: [
      { $ref: '#/components/schemas/PlainTextDto' },
      { $ref: '#/components/schemas/MrkdwnTextDto' },
    ],
  })
  @ValidateNested()
  @IsObject()
  text: PlainTextDto | MrkdwnTextDto;

  @ApiProperty({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  confirm: PlainTextDto;

  @ApiProperty({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  deny: PlainTextDto;

  @ApiEnumProperty(
    { primary: 'primary', danger: 'danger' },
    'Visual style of the confirm button',
    false,
    'primary',
  )
  style?: 'primary' | 'danger';
}

/** ---------- Interactive Elements ---------- */

/**
 * Button element DTO
 */
export class SlackButtonElementDto {
  @ApiProperty({
    description: 'Element type',
    example: 'button',
    enum: ['button'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['button'])
  type = 'button' as const;

  @ApiProperty({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  text: PlainTextDto;

  @ApiTextProperty({
    required: true,
    maxLength: 255,
    description: 'Unique identifier for the action',
    example: 'approve_request',
  })
  action_id: string;

  @ApiPropertyOptional({
    description: 'URL to open when clicked',
    example: 'https://example.com/approve',
  })
  @IsUrl()
  @IsOptional()
  url?: string;

  @ApiTextProperty({
    required: false,
    maxLength: 2000,
    description: 'Value sent when clicked',
    example: 'request_123',
  })
  value?: string;

  @ApiEnumProperty(
    { primary: 'primary', danger: 'danger' },
    'Visual style of the button',
    false,
    'primary',
  )
  style?: 'primary' | 'danger';

  @ApiPropertyOptional({ type: SlackConfirmDialogDto })
  @ValidateNested()
  @TransformType(() => SlackConfirmDialogDto)
  @IsOptional()
  confirm?: SlackConfirmDialogDto;

  @ApiTextProperty({
    required: false,
    maxLength: 75,
    description: 'Accessibility label',
    example: 'Approve this request',
  })
  accessibility_label?: string;
}

/**
 * Static select menu element DTO
 */
export class SlackStaticSelectElementDto {
  @ApiProperty({
    description: 'Element type',
    example: 'static_select',
    enum: ['static_select'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['static_select'])
  type = 'static_select' as const;

  @ApiProperty({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  placeholder: PlainTextDto;

  @ApiTextProperty({
    required: true,
    maxLength: 255,
    description: 'Unique identifier for the action',
    example: 'priority_select',
  })
  action_id: string;

  @ApiPropertyOptional({
    type: [SlackOptionDto],
    description: 'List of options',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @TransformType(() => SlackOptionDto)
  @ArrayMaxSize(100)
  @IsOptional()
  options?: SlackOptionDto[];

  @ApiPropertyOptional({
    type: [SlackOptionGroupDto],
    description: 'List of option groups',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @TransformType(() => SlackOptionGroupDto)
  @ArrayMaxSize(100)
  @IsOptional()
  option_groups?: SlackOptionGroupDto[];

  @ApiPropertyOptional({ type: SlackOptionDto })
  @ValidateNested()
  @TransformType(() => SlackOptionDto)
  @IsOptional()
  initial_option?: SlackOptionDto;

  @ApiPropertyOptional({ type: SlackConfirmDialogDto })
  @ValidateNested()
  @TransformType(() => SlackConfirmDialogDto)
  @IsOptional()
  confirm?: SlackConfirmDialogDto;

  @ApiBooleanProperty('Focus on load', false, false)
  focus_on_load?: boolean;
}

/**
 * Plain text input element DTO
 */
export class SlackPlainTextInputElementDto {
  @ApiProperty({
    description: 'Element type',
    example: 'plain_text_input',
    enum: ['plain_text_input'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['plain_text_input'])
  type = 'plain_text_input' as const;

  @ApiTextProperty({
    required: true,
    maxLength: 255,
    description: 'Unique identifier for the action',
    example: 'user_comment',
  })
  action_id: string;

  @ApiPropertyOptional({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  @IsOptional()
  placeholder?: PlainTextDto;

  @ApiTextProperty({
    required: false,
    maxLength: 3000,
    description: 'Initial value',
    example: 'Default text...',
  })
  initial_value?: string;

  @ApiBooleanProperty('Whether input is multi-line', false, false)
  multiline?: boolean;

  @ApiPropertyOptional({
    description: 'Minimum length',
    example: 1,
    type: Number,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string))
  min_length?: number;

  @ApiPropertyOptional({
    description: 'Maximum length',
    example: 500,
    type: Number,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string))
  max_length?: number;

  @ApiBooleanProperty('Focus on load', false, false)
  focus_on_load?: boolean;
}

/**
 * Image element DTO
 */
export class SlackImageElementDto {
  @ApiProperty({
    description: 'Element type',
    example: 'image',
    enum: ['image'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['image'])
  type = 'image' as const;

  @ApiProperty({
    description: 'Image URL',
    example: 'https://example.com/image.png',
  })
  @IsUrl()
  @IsNotEmpty()
  image_url: string;

  @ApiTextProperty({
    required: true,
    maxLength: 2000,
    description: 'Alt text for accessibility',
    example: 'Chart showing sales data',
  })
  alt_text: string;
}

/** ---------- Layout Blocks ---------- */

/**
 * Section block DTO
 */
export class SlackSectionBlockDto {
  @ApiProperty({
    description: 'Block type',
    example: 'section',
    enum: ['section'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['section'])
  type = 'section' as const;

  @ApiPropertyOptional({
    oneOf: [
      { $ref: '#/components/schemas/PlainTextDto' },
      { $ref: '#/components/schemas/MrkdwnTextDto' },
    ],
  })
  @ValidateNested()
  @IsOptional()
  text?: PlainTextDto | MrkdwnTextDto;

  @ApiPropertyOptional({
    type: [Object],
    description: 'Array of text objects (max 10, displayed in 2 columns)',
  })
  @IsArray()
  @ArrayMaxSize(10)
  @IsOptional()
  fields?: (PlainTextDto | MrkdwnTextDto)[];

  @ApiPropertyOptional({
    oneOf: [
      { $ref: '#/components/schemas/SlackImageElementDto' },
      { $ref: '#/components/schemas/SlackButtonElementDto' },
      { $ref: '#/components/schemas/SlackStaticSelectElementDto' },
    ],
  })
  @ValidateNested()
  @IsOptional()
  accessory?:
    | SlackImageElementDto
    | SlackButtonElementDto
    | SlackStaticSelectElementDto;

  @ApiTextProperty({
    required: false,
    maxLength: 255,
    description: 'Unique identifier for the block',
    example: 'section_1',
  })
  block_id?: string;
}

/**
 * Header block DTO
 */
export class SlackHeaderBlockDto {
  @ApiProperty({
    description: 'Block type',
    example: 'header',
    enum: ['header'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['header'])
  type = 'header' as const;

  @ApiProperty({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  text: PlainTextDto;

  @ApiTextProperty({
    required: false,
    maxLength: 255,
    description: 'Unique identifier for the block',
    example: 'header_1',
  })
  block_id?: string;
}

/**
 * Divider block DTO
 */
export class SlackDividerBlockDto {
  @ApiProperty({
    description: 'Block type',
    example: 'divider',
    enum: ['divider'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['divider'])
  type = 'divider' as const;

  @ApiTextProperty({
    required: false,
    maxLength: 255,
    description: 'Unique identifier for the block',
    example: 'divider_1',
  })
  block_id?: string;
}

/**
 * Context block DTO
 */
export class SlackContextBlockDto {
  @ApiProperty({
    description: 'Block type',
    example: 'context',
    enum: ['context'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['context'])
  type = 'context' as const;

  @ApiProperty({
    type: [Object],
    description: 'Array of text objects and images (max 10)',
  })
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  elements: (PlainTextDto | MrkdwnTextDto | SlackImageElementDto)[];

  @ApiTextProperty({
    required: false,
    maxLength: 255,
    description: 'Unique identifier for the block',
    example: 'context_1',
  })
  block_id?: string;
}

/**
 * Actions block DTO
 */
export class SlackActionsBlockDto {
  @ApiProperty({
    description: 'Block type',
    example: 'actions',
    enum: ['actions'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['actions'])
  type = 'actions' as const;

  @ApiProperty({
    type: [Object],
    description: 'Array of interactive elements (max 25)',
  })
  @IsArray()
  @ArrayMaxSize(25)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  elements: (
    | SlackButtonElementDto
    | SlackStaticSelectElementDto
    | SlackPlainTextInputElementDto
  )[];

  @ApiTextProperty({
    required: false,
    maxLength: 255,
    description: 'Unique identifier for the block',
    example: 'actions_1',
  })
  block_id?: string;
}

/**
 * Image block DTO
 */
export class SlackImageBlockDto {
  @ApiProperty({
    description: 'Block type',
    example: 'image',
    enum: ['image'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['image'])
  type = 'image' as const;

  @ApiProperty({
    description: 'Image URL',
    example: 'https://example.com/chart.png',
  })
  @IsUrl()
  @IsNotEmpty()
  image_url: string;

  @ApiTextProperty({
    required: true,
    maxLength: 2000,
    description: 'Alt text for accessibility',
    example: 'Sales performance chart',
  })
  alt_text: string;

  @ApiPropertyOptional({ type: PlainTextDto })
  @ValidateNested()
  @TransformType(() => PlainTextDto)
  @IsOptional()
  title?: PlainTextDto;

  @ApiTextProperty({
    required: false,
    maxLength: 255,
    description: 'Unique identifier for the block',
    example: 'image_1',
  })
  block_id?: string;
}

/** ---------- Main Container DTOs ---------- */

/**
 * Union type representing all possible block types
 */
export type SlackBlockDto =
  | SlackSectionBlockDto
  | SlackHeaderBlockDto
  | SlackDividerBlockDto
  | SlackContextBlockDto
  | SlackActionsBlockDto
  | SlackImageBlockDto;

/**
 * Slack message blocks container DTO
 */
export class SlackMessageBlocksDto {
  @ApiProperty({
    type: [Object],
    description: 'Array of blocks representing message content (max 50)',
    example: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Payment Alert',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Payment failed for *customer@example.com*',
        },
      },
    ],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  blocks: SlackBlockDto[];
}

/**
 * Complete Slack message DTO combining all elements
 */
export class SlackMessageDto {
  @ApiPropertyOptional({
    description: 'Optional plain text fallback for notifications',
    example: 'Payment Alert: Payment failed for customer@example.com',
    maxLength: 3000,
  })
  @IsString()
  @MaxLength(3000)
  @IsOptional()
  text?: string;

  @ApiProperty({ type: SlackMessageBlocksDto })
  @ValidateNested()
  @TransformType(() => SlackMessageBlocksDto)
  blocks: SlackMessageBlocksDto;

  @ApiPropertyOptional({
    description: 'Additional message metadata',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
