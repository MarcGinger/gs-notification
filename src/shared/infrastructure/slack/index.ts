/**
 * Slack Block Kit DTO Exports
 *
 * Centralized exports for all Slack Block Kit Data Transfer Objects
 * and utility functions for building validated Slack messages.
 *
 * @version 1.0.0
 */

// Text Objects
export { PlainTextDto, MrkdwnTextDto } from './slack-block-kit.dto';

// Composition Objects
export {
  SlackOptionDto,
  SlackOptionGroupDto,
  SlackConfirmDialogDto,
} from './slack-block-kit.dto';

// Interactive Elements
export {
  SlackButtonElementDto,
  SlackStaticSelectElementDto,
  SlackPlainTextInputElementDto,
  SlackImageElementDto,
} from './slack-block-kit.dto';

// Layout Blocks
export {
  SlackSectionBlockDto,
  SlackHeaderBlockDto,
  SlackDividerBlockDto,
  SlackContextBlockDto,
  SlackActionsBlockDto,
  SlackImageBlockDto,
} from './slack-block-kit.dto';

// Container DTOs
export {
  SlackBlockDto,
  SlackMessageBlocksDto,
  SlackMessageDto,
} from './slack-block-kit.dto';

// Re-export types from the types file for convenience
export type {
  SlackTextObject,
  SlackBlock,
  SlackContentBlocks,
  SlackButtonElement,
  SlackStaticSelectElement,
  SlackPlainTextInputElement,
  SlackImageElement,
  SlackSectionBlock,
  SlackHeaderBlock,
  SlackDividerBlock,
  SlackContextBlock,
  SlackActionsBlock,
  SlackImageBlock,
  SlackOption,
  SlackOptionGroup,
  SlackConfirmDialog,
} from './slack-block-kit.types';

// Re-export utility functions and type guards
export {
  isPlainText,
  isMrkdwn,
  isSlackText,
  isSlackOption,
  isSlackConfirmDialog,
  isSlackBlock,
  isSlackContentBlocks,
  createPlainText,
  createMrkdwnText,
  createSectionBlock,
  createHeaderBlock,
  createDividerBlock,
  createButtonElement,
  isValidTextLength,
  truncateText,
} from './slack-block-kit.types';