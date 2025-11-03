/**
 * Record Message Sent Props
 * Domain props for recording successful message delivery
 */
export interface MessageRequestSentProps {
  id: string;
  attempts: number;
  correlationId?: string;
  causationId?: string;
}
