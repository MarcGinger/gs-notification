/**
 * Slack Block Kit DTO Usage Examples
 *
 * This file demonstrates how to use the generated DTOs for creating
 * validated Slack Block Kit messages with proper type safety.
 *
 * @example
 */

import {
  SlackMessageDto,
  SlackSectionBlockDto,
  SlackHeaderBlockDto,
  SlackDividerBlockDto,
  SlackActionsBlockDto,
  SlackButtonElementDto,
  PlainTextDto,
  MrkdwnTextDto,
} from './slack-block-kit.dto';

/**
 * Example: Creating a payment alert message
 */
export const createPaymentAlertMessage = (): SlackMessageDto => {
  const headerText: PlainTextDto = {
    type: 'plain_text',
    text: '🚨 Payment Alert',
    emoji: true,
  };

  const sectionText: MrkdwnTextDto = {
    type: 'mrkdwn',
    text: '*Payment Failed*\n\nCustomer: customer@example.com\nAmount: $299.99\nReason: Insufficient funds',
  };

  const approveButton: SlackButtonElementDto = {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Retry Payment',
      emoji: true,
    },
    action_id: 'retry_payment',
    style: 'primary',
    value: 'payment_123',
  };

  const cancelButton: SlackButtonElementDto = {
    type: 'button',
    text: {
      type: 'plain_text',
      text: 'Cancel Order',
      emoji: true,
    },
    action_id: 'cancel_order',
    style: 'danger',
    value: 'order_456',
  };

  const headerBlock: SlackHeaderBlockDto = {
    type: 'header',
    text: headerText,
    block_id: 'payment_alert_header',
  };

  const sectionBlock: SlackSectionBlockDto = {
    type: 'section',
    text: sectionText,
    block_id: 'payment_details',
  };

  const dividerBlock: SlackDividerBlockDto = {
    type: 'divider',
    block_id: 'divider_1',
  };

  const actionsBlock: SlackActionsBlockDto = {
    type: 'actions',
    elements: [approveButton, cancelButton],
    block_id: 'payment_actions',
  };

  return {
    text: 'Payment Alert: Payment failed for customer@example.com',
    blocks: {
      blocks: [headerBlock, sectionBlock, dividerBlock, actionsBlock],
    },
    metadata: {
      event_type: 'payment_failed',
      customer_id: 'cust_123',
      payment_id: 'pay_456',
    },
  };
};

/**
 * Example: Creating a simple notification message
 */
export const createNotificationMessage = (
  title: string,
  message: string,
): SlackMessageDto => {
  const headerBlock: SlackHeaderBlockDto = {
    type: 'header',
    text: {
      type: 'plain_text',
      text: title,
      emoji: true,
    },
  };

  const sectionBlock: SlackSectionBlockDto = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: message,
    },
  };

  return {
    text: `${title}: ${message}`,
    blocks: {
      blocks: [headerBlock, sectionBlock],
    },
  };
};

/**
 * Example: Creating a form-like message with input
 */
export const createFeedbackRequestMessage = (): SlackMessageDto => {
  const headerBlock: SlackHeaderBlockDto = {
    type: 'header',
    text: {
      type: 'plain_text',
      text: '📝 Feedback Request',
      emoji: true,
    },
  };

  const sectionBlock: SlackSectionBlockDto = {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'We value your feedback! Please let us know how we can improve our service.',
    },
  };

  return {
    text: 'Feedback Request: We value your feedback!',
    blocks: {
      blocks: [headerBlock, sectionBlock, { type: 'divider' }],
    },
  };
};
