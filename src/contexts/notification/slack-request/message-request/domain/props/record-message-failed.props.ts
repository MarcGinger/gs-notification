/**
 * Record Message Failed Props
 * Domain props for recording message delivery failure
 */
export interface RecordMessageFailedProps {
  id: string;
  reason: string;
  attempts: number;
  retryable?: boolean;
  lastError?: string;
  correlationId?: string;
  causationId?: string;
}
