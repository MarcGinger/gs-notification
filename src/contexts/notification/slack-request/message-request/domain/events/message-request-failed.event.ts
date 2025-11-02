/**
 * MessageRequest Failed Event Payload
 * Contains complete business context - full message request state at time of failure
 */
export interface MessageRequestFailedEventPayload {
  id: string;
  recipient: string;
  data: Record<string, any>;
  status: string;
  workspaceCode: string;
  templateCode: string;
  channelCode: string;
  reason: string; // normalized error code (e.g., 'invalid_auth')
  attempts: number;
  retryable?: boolean;
  lastError?: string;
}

/**
 * MessageRequest Failed Domain Event
 *
 * Emitted when messageRequest delivery fails permanently.
 * Contains failure metadata for troubleshooting and monitoring.
 */
export class MessageRequestFailedEvent {
  public readonly eventType = 'NotificationSlackRequestMessageFailed.v1';
  public readonly eventVersion = 'v1';

  constructor(public readonly payload: MessageRequestFailedEventPayload) {}

  // Factory method - no metadata needed, just business data
  static create(
    data: MessageRequestFailedEventPayload,
  ): MessageRequestFailedEvent {
    return new MessageRequestFailedEvent(data);
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

  get reason(): string {
    return this.payload.reason;
  }

  get attempts(): number {
    return this.payload.attempts;
  }

  get retryable(): boolean | undefined {
    return this.payload.retryable;
  }

  get lastError(): string | undefined {
    return this.payload.lastError;
  }
}
