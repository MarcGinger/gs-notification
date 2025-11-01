/**
 * Slack Block Kit TypeScript Definitions
 *
 * Comprehensive type definitions for Slack Block Kit components including
 * text objects, elements, blocks, and interactive components.
 *
 * @see https://api.slack.com/block-kit
 * @version 1.0.0
 */

/** ---------- Text Objects ---------- */

/**
 * Markdown-enabled text object
 * @see https://api.slack.com/reference/block-kit/composition-objects#text
 */
export type MrkdwnText = {
  type: 'mrkdwn';
  /** Text content with markdown support */
  text: string;
  /** When true, disables formatting and treats text as literal */
  verbatim?: boolean;
};

/**
 * Plain text object without markdown support
 * @see https://api.slack.com/reference/block-kit/composition-objects#text
 */
export type PlainText = {
  type: 'plain_text';
  /** Plain text content (no markdown) */
  text: string;
  /** Whether to allow emoji shortcodes like :smile: */
  emoji?: boolean;
};

/**
 * Union type for all text objects
 */
export type SlackTextObject = MrkdwnText | PlainText;

/** ---------- Composition Objects ---------- */

/**
 * Confirm dialog object for dangerous actions
 * @see https://api.slack.com/reference/block-kit/composition-objects#confirm
 */
export type SlackConfirmDialog = {
  /** Dialog title (max 100 characters) */
  title: PlainText;
  /** Explanatory text */
  text: SlackTextObject;
  /** Text for the confirm button (max 30 characters) */
  confirm: PlainText;
  /** Text for the deny button (max 30 characters) */
  deny: PlainText;
  /** Visual style of the confirm button */
  style?: 'primary' | 'danger';
};

/**
 * Option object for select menus
 * @see https://api.slack.com/reference/block-kit/composition-objects#option
 */
export type SlackOption = {
  /** User-facing text */
  text: PlainText;
  /** String value sent when selected (max 75 characters) */
  value: string;
  /** Short description */
  description?: PlainText;
  /** URL to load in user's browser when option is clicked */
  url?: string;
};

/**
 * Option group for organizing select options
 * @see https://api.slack.com/reference/block-kit/composition-objects#option_group
 */
export type SlackOptionGroup = {
  /** Group label */
  label: PlainText;
  /** Options in this group (max 100) */
  options: SlackOption[];
};

/** ---------- Interactive Elements ---------- */

/**
 * Button element for user interactions
 * @see https://api.slack.com/reference/block-kit/block-elements#button
 */
export type SlackButtonElement = {
  type: 'button';
  /** Button text (max 75 characters) */
  text: PlainText;
  /** Unique identifier for the action */
  action_id: string;
  /** URL to open when clicked */
  url?: string;
  /** Value sent when clicked (max 2000 characters) */
  value?: string;
  /** Visual style */
  style?: 'primary' | 'danger';
  /** Confirmation dialog */
  confirm?: SlackConfirmDialog;
  /** Accessibility label */
  accessibility_label?: string;
};

/**
 * Static select menu element
 * @see https://api.slack.com/reference/block-kit/block-elements#static_select
 */
export type SlackStaticSelectElement = {
  type: 'static_select';
  /** Placeholder text */
  placeholder: PlainText;
  /** Unique identifier for the action */
  action_id: string;
  /** List of options */
  options?: SlackOption[];
  /** List of option groups */
  option_groups?: SlackOptionGroup[];
  /** Initially selected option */
  initial_option?: SlackOption;
  /** Confirmation dialog */
  confirm?: SlackConfirmDialog;
  /** Focus on load */
  focus_on_load?: boolean;
};

/**
 * Multi-select static menu element
 * @see https://api.slack.com/reference/block-kit/block-elements#multi_static_select
 */
export type SlackMultiStaticSelectElement = {
  type: 'multi_static_select';
  /** Placeholder text */
  placeholder: PlainText;
  /** Unique identifier for the action */
  action_id: string;
  /** List of options */
  options?: SlackOption[];
  /** List of option groups */
  option_groups?: SlackOptionGroup[];
  /** Initially selected options */
  initial_options?: SlackOption[];
  /** Maximum number of selections */
  max_selected_items?: number;
  /** Confirmation dialog */
  confirm?: SlackConfirmDialog;
  /** Focus on load */
  focus_on_load?: boolean;
};

/**
 * Plain text input element
 * @see https://api.slack.com/reference/block-kit/block-elements#input
 */
export type SlackPlainTextInputElement = {
  type: 'plain_text_input';
  /** Unique identifier for the action */
  action_id: string;
  /** Placeholder text */
  placeholder?: PlainText;
  /** Initial value */
  initial_value?: string;
  /** Whether input is multi-line */
  multiline?: boolean;
  /** Minimum length */
  min_length?: number;
  /** Maximum length */
  max_length?: number;
  /** Input format */
  dispatch_action_config?: {
    trigger_actions_on?: ('on_enter_pressed' | 'on_character_entered')[];
  };
  /** Focus on load */
  focus_on_load?: boolean;
};

/**
 * Image element for display
 * @see https://api.slack.com/reference/block-kit/block-elements#image
 */
export type SlackImageElement = {
  type: 'image';
  /** Image URL */
  image_url: string;
  /** Alt text for accessibility */
  alt_text: string;
};

/** ---------- Element Unions ---------- */

/**
 * Elements allowed in context blocks
 */
export type SlackContextElement = SlackImageElement | MrkdwnText | PlainText;

/**
 * Elements allowed as section accessories
 */
export type SlackSectionAccessory =
  | SlackImageElement
  | SlackButtonElement
  | SlackStaticSelectElement
  | SlackMultiStaticSelectElement
  | SlackPlainTextInputElement;

/**
 * Interactive elements for actions blocks
 */
export type SlackActionElement =
  | SlackButtonElement
  | SlackStaticSelectElement
  | SlackMultiStaticSelectElement
  | SlackPlainTextInputElement;

/** ---------- Layout Blocks ---------- */

/**
 * Section block - versatile layout block for text, fields, and accessories
 * @see https://api.slack.com/reference/block-kit/blocks#section
 */
export type SlackSectionBlock = {
  type: 'section';
  /** Main text content */
  text?: SlackTextObject;
  /** Array of text objects (max 10, displayed in 2 columns) */
  fields?: SlackTextObject[];
  /** Interactive element or image */
  accessory?: SlackSectionAccessory;
  /** Unique identifier for the block */
  block_id?: string;
};

/**
 * Divider block - visual separator
 * @see https://api.slack.com/reference/block-kit/blocks#divider
 */
export type SlackDividerBlock = {
  type: 'divider';
  /** Unique identifier for the block */
  block_id?: string;
};

/**
 * Header block - large text header
 * @see https://api.slack.com/reference/block-kit/blocks#header
 */
export type SlackHeaderBlock = {
  type: 'header';
  /** Header text (max 150 characters, plain text only) */
  text: PlainText;
  /** Unique identifier for the block */
  block_id?: string;
};

/**
 * Context block - contextual information with small text and images
 * @see https://api.slack.com/reference/block-kit/blocks#context
 */
export type SlackContextBlock = {
  type: 'context';
  /** Array of text objects and images (max 10) */
  elements: SlackContextElement[];
  /** Unique identifier for the block */
  block_id?: string;
};

/**
 * Actions block - interactive elements container
 * @see https://api.slack.com/reference/block-kit/blocks#actions
 */
export type SlackActionsBlock = {
  type: 'actions';
  /** Array of interactive elements (max 25) */
  elements: SlackActionElement[];
  /** Unique identifier for the block */
  block_id?: string;
};

/**
 * Image block - standalone image display
 * @see https://api.slack.com/reference/block-kit/blocks#image
 */
export type SlackImageBlock = {
  type: 'image';
  /** Image URL */
  image_url: string;
  /** Alt text for accessibility */
  alt_text: string;
  /** Optional title */
  title?: PlainText;
  /** Unique identifier for the block */
  block_id?: string;
};

/**
 * Input block - form input with label
 * @see https://api.slack.com/reference/block-kit/blocks#input
 */
export type SlackInputBlock = {
  type: 'input';
  /** Input label */
  label: PlainText;
  /** Input element */
  element:
    | SlackPlainTextInputElement
    | SlackStaticSelectElement
    | SlackMultiStaticSelectElement;
  /** Unique identifier for the block */
  block_id?: string;
  /** Optional hint text */
  hint?: PlainText;
  /** Whether the input is optional */
  optional?: boolean;
  /** Dispatch action configuration */
  dispatch_action?: boolean;
};

/**
 * Rich text block - formatted text with styling
 * @see https://api.slack.com/reference/block-kit/blocks#rich_text
 */
export type SlackRichTextBlock = {
  type: 'rich_text';
  /** Rich text elements */
  elements: SlackRichTextElement[];
  /** Unique identifier for the block */
  block_id?: string;
};

/**
 * Rich text elements (simplified for common use cases)
 */
export type SlackRichTextElement = {
  type:
    | 'rich_text_section'
    | 'rich_text_list'
    | 'rich_text_preformatted'
    | 'rich_text_quote';
  /** Element content */
  elements?: unknown[];
  /** Additional properties based on element type */
  [key: string]: unknown;
};

/**
 * File block - file display and download
 * @see https://api.slack.com/reference/block-kit/blocks#file
 */
export type SlackFileBlock = {
  type: 'file';
  /** File ID */
  external_id: string;
  /** File source */
  source: string;
  /** Unique identifier for the block */
  block_id?: string;
};

/** ---------- Block Unions ---------- */

/**
 * Union of all supported layout blocks
 */
export type SlackBlock =
  | SlackSectionBlock
  | SlackDividerBlock
  | SlackHeaderBlock
  | SlackContextBlock
  | SlackActionsBlock
  | SlackImageBlock
  | SlackInputBlock
  | SlackRichTextBlock
  | SlackFileBlock;

/**
 * Array of blocks representing message content
 * Maximum 50 blocks per message
 */
export type SlackContentBlocks = SlackBlock[];

/** ---------- Type Safety Helpers (Type Guards) ---------- */

/**
 * Type guard for PlainText objects
 * @param t - Object to check
 * @returns true if t is a valid PlainText object
 */
export const isPlainText = (t: unknown): t is PlainText => {
  if (!t || typeof t !== 'object') return false;
  const obj = t as Record<string, unknown>;
  return obj.type === 'plain_text' && typeof obj.text === 'string';
};

/**
 * Type guard for MrkdwnText objects
 * @param t - Object to check
 * @returns true if t is a valid MrkdwnText object
 */
export const isMrkdwn = (t: unknown): t is MrkdwnText => {
  if (!t || typeof t !== 'object') return false;
  const obj = t as Record<string, unknown>;
  return obj.type === 'mrkdwn' && typeof obj.text === 'string';
};

/**
 * Type guard for any SlackTextObject
 * @param t - Object to check
 * @returns true if t is a valid SlackTextObject
 */
export const isSlackText = (t: unknown): t is SlackTextObject =>
  isPlainText(t) || isMrkdwn(t);

/**
 * Type guard for SlackOption objects
 * @param opt - Object to check
 * @returns true if opt is a valid SlackOption
 */
export const isSlackOption = (opt: unknown): opt is SlackOption => {
  if (!opt || typeof opt !== 'object') return false;
  const obj = opt as Record<string, unknown>;
  return (
    isPlainText(obj.text) &&
    typeof obj.value === 'string' &&
    obj.value.length <= 75
  );
};

/**
 * Type guard for SlackConfirmDialog objects
 * @param confirm - Object to check
 * @returns true if confirm is a valid SlackConfirmDialog
 */
export const isSlackConfirmDialog = (
  confirm: unknown,
): confirm is SlackConfirmDialog => {
  if (!confirm || typeof confirm !== 'object') return false;
  const obj = confirm as Record<string, unknown>;
  return (
    isPlainText(obj.title) &&
    isSlackText(obj.text) &&
    isPlainText(obj.confirm) &&
    isPlainText(obj.deny) &&
    (!obj.style || obj.style === 'primary' || obj.style === 'danger')
  );
};

/**
 * Type guard for SlackBlock objects with comprehensive validation
 * @param b - Object to check
 * @returns true if b is a valid SlackBlock
 */
export function isSlackBlock(b: unknown): b is SlackBlock {
  if (!b || typeof b !== 'object') return false;
  const obj = b as Record<string, unknown>;

  switch (obj.type) {
    case 'section':
      return isSlackSectionBlock(obj);

    case 'divider':
      return isSlackDividerBlock(obj);

    case 'header':
      return isSlackHeaderBlock(obj);

    case 'context':
      return isSlackContextBlock(obj);

    case 'actions':
      return isSlackActionsBlock(obj);

    case 'image':
      return isSlackImageBlock(obj);

    case 'input':
      return isSlackInputBlock(obj);

    case 'rich_text':
      return isSlackRichTextBlock(obj);

    case 'file':
      return isSlackFileBlock(obj);

    default:
      return false;
  }
}

/**
 * Type guard for SlackSectionBlock
 */
function isSlackSectionBlock(
  obj: Record<string, unknown>,
): obj is SlackSectionBlock {
  if (obj.text && !isSlackText(obj.text)) return false;
  if (
    obj.fields &&
    (!Array.isArray(obj.fields) || !obj.fields.every(isSlackText))
  )
    return false;
  if (obj.accessory && !isSlackSectionAccessory(obj.accessory)) return false;
  return true;
}

/**
 * Type guard for SlackDividerBlock
 */
function isSlackDividerBlock(
  obj: Record<string, unknown>,
): obj is SlackDividerBlock {
  return obj.type === 'divider';
}

/**
 * Type guard for SlackHeaderBlock
 */
function isSlackHeaderBlock(
  obj: Record<string, unknown>,
): obj is SlackHeaderBlock {
  return isPlainText(obj.text);
}

/**
 * Type guard for SlackContextBlock
 */
function isSlackContextBlock(
  obj: Record<string, unknown>,
): obj is SlackContextBlock {
  return (
    Array.isArray(obj.elements) && obj.elements.every(isSlackContextElement)
  );
}

/**
 * Type guard for SlackActionsBlock
 */
function isSlackActionsBlock(
  obj: Record<string, unknown>,
): obj is SlackActionsBlock {
  return (
    Array.isArray(obj.elements) && obj.elements.every(isSlackActionElement)
  );
}

/**
 * Type guard for SlackImageBlock
 */
function isSlackImageBlock(
  obj: Record<string, unknown>,
): obj is SlackImageBlock {
  return (
    typeof obj.image_url === 'string' &&
    typeof obj.alt_text === 'string' &&
    (!obj.title || isPlainText(obj.title))
  );
}

/**
 * Type guard for SlackInputBlock
 */
function isSlackInputBlock(
  obj: Record<string, unknown>,
): obj is SlackInputBlock {
  return (
    isPlainText(obj.label) &&
    Boolean(obj.element) &&
    isSlackInputElement(obj.element) &&
    (!obj.hint || isPlainText(obj.hint))
  );
}

/**
 * Type guard for SlackRichTextBlock
 */
function isSlackRichTextBlock(
  obj: Record<string, unknown>,
): obj is SlackRichTextBlock {
  return Array.isArray(obj.elements);
}

/**
 * Type guard for SlackFileBlock
 */
function isSlackFileBlock(obj: Record<string, unknown>): obj is SlackFileBlock {
  return typeof obj.external_id === 'string' && typeof obj.source === 'string';
}

/**
 * Type guard for SlackContextElement
 */
function isSlackContextElement(el: unknown): el is SlackContextElement {
  if (!el || typeof el !== 'object') return false;
  const obj = el as Record<string, unknown>;

  return (
    (obj.type === 'image' &&
      typeof obj.image_url === 'string' &&
      typeof obj.alt_text === 'string') ||
    isSlackText(obj)
  );
}

/**
 * Type guard for SlackSectionAccessory
 */
function isSlackSectionAccessory(el: unknown): el is SlackSectionAccessory {
  if (!el || typeof el !== 'object') return false;
  const obj = el as Record<string, unknown>;

  switch (obj.type) {
    case 'image':
      return (
        typeof obj.image_url === 'string' && typeof obj.alt_text === 'string'
      );
    case 'button':
      return isPlainText(obj.text) && typeof obj.action_id === 'string';
    case 'static_select':
    case 'multi_static_select':
      return isPlainText(obj.placeholder) && typeof obj.action_id === 'string';
    case 'plain_text_input':
      return typeof obj.action_id === 'string';
    default:
      return false;
  }
}

/**
 * Type guard for SlackActionElement
 */
function isSlackActionElement(el: unknown): el is SlackActionElement {
  if (!el || typeof el !== 'object') return false;
  const obj = el as Record<string, unknown>;

  switch (obj.type) {
    case 'button':
      return isPlainText(obj.text) && typeof obj.action_id === 'string';
    case 'static_select':
    case 'multi_static_select':
      return isPlainText(obj.placeholder) && typeof obj.action_id === 'string';
    case 'plain_text_input':
      return typeof obj.action_id === 'string';
    default:
      return false;
  }
}

/**
 * Type guard for input elements
 */
function isSlackInputElement(el: unknown): boolean {
  if (!el || typeof el !== 'object') return false;
  const obj = el as Record<string, unknown>;

  return (
    obj.type === 'plain_text_input' ||
    obj.type === 'static_select' ||
    obj.type === 'multi_static_select'
  );
}

/**
 * Type guard for SlackContentBlocks with length validation
 * @param blocks - Array to check
 * @param max - Maximum number of blocks allowed (default: 50)
 * @returns true if blocks is a valid SlackContentBlocks array
 */
export function isSlackContentBlocks(
  blocks: unknown,
  max = 50,
): blocks is SlackContentBlocks {
  return (
    Array.isArray(blocks) &&
    blocks.length > 0 &&
    blocks.length <= max &&
    blocks.every(isSlackBlock)
  );
}

/** ---------- Utility Functions ---------- */

/**
 * Creates a plain text object
 * @param text - The text content
 * @param emoji - Whether to allow emoji shortcodes (default: true)
 * @returns PlainText object
 */
export function createPlainText(text: string, emoji = true): PlainText {
  return { type: 'plain_text', text, emoji };
}

/**
 * Creates a markdown text object
 * @param text - The markdown text content
 * @param verbatim - Whether to disable formatting (default: false)
 * @returns MrkdwnText object
 */
export function createMrkdwnText(text: string, verbatim = false): MrkdwnText {
  return { type: 'mrkdwn', text, verbatim };
}

/**
 * Creates a section block
 * @param text - Main text content
 * @param options - Additional section options
 * @returns SlackSectionBlock object
 */
export function createSectionBlock(
  text?: SlackTextObject,
  options?: {
    fields?: SlackTextObject[];
    accessory?: SlackSectionAccessory;
    block_id?: string;
  },
): SlackSectionBlock {
  return {
    type: 'section',
    text,
    ...options,
  };
}

/**
 * Creates a header block
 * @param text - Header text (max 150 characters)
 * @param block_id - Optional block identifier
 * @returns SlackHeaderBlock object
 */
export function createHeaderBlock(
  text: string,
  block_id?: string,
): SlackHeaderBlock {
  return {
    type: 'header',
    text: createPlainText(text),
    block_id,
  };
}

/**
 * Creates a divider block
 * @param block_id - Optional block identifier
 * @returns SlackDividerBlock object
 */
export function createDividerBlock(block_id?: string): SlackDividerBlock {
  return { type: 'divider', block_id };
}

/**
 * Creates a button element
 * @param text - Button text
 * @param action_id - Unique action identifier
 * @param options - Additional button options
 * @returns SlackButtonElement object
 */
export function createButtonElement(
  text: string,
  action_id: string,
  options?: {
    url?: string;
    value?: string;
    style?: 'primary' | 'danger';
    confirm?: SlackConfirmDialog;
  },
): SlackButtonElement {
  return {
    type: 'button',
    text: createPlainText(text),
    action_id,
    ...options,
  };
}

/**
 * Validates that a text string meets Slack's length requirements
 * @param text - Text to validate
 * @param maxLength - Maximum allowed length
 * @returns true if text length is valid
 */
export function isValidTextLength(text: string, maxLength: number): boolean {
  return text.length > 0 && text.length <= maxLength;
}

/**
 * Truncates text to fit Slack's requirements
 * @param text - Text to truncate
 * @param maxLength - Maximum allowed length
 * @param suffix - Suffix to add when truncating (default: '...')
 * @returns Truncated text
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix = '...',
): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}
