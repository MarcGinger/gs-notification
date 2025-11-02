/**
 * MessageRequest Sent Event Payload
 * Contains complete business context - full message request state at time of successful delivery
 */
export interface MessageRequestSentEventPayload {
  id: string;
  recipient: string;
  data: Record<string, any>;
  status: string;
  workspaceCode: string;
  templateCode: string;
  channelCode: string;
  attempts: number;
}

/**
 * MessageRequest Sent Domain Event
 *
 * Emitted when messageRequest is successfully delivered to Slack.
 * Contains delivery metadata for audit and downstream processing.
 */
export class MessageRequestSentEvent {
  public readonly eventType = 'NotificationSlackRequestMessageSent.v1';
  public readonly eventVersion = 'v1';

  constructor(public readonly payload: MessageRequestSentEventPayload) {}

  // Factory method - no metadata needed, just business data
  static create(data: MessageRequestSentEventPayload): MessageRequestSentEvent {
    return new MessageRequestSentEvent(data);
  }

  get id(): string {
    return this.payload.id;
  }

  get recipient(): string {
    return this.payload.recipient;
  }

  get data(): Record<string, any> {
    return this.payload.data;
  }

  get status(): string {
    return this.payload.status;
  }

  get workspaceCode(): string {
    return this.payload.workspaceCode;
  }

  get templateCode(): string {
    return this.payload.templateCode;
  }

  get channelCode(): string {
    return this.payload.channelCode;
  }

  get attempts(): number {
    return this.payload.attempts;
  }
}
