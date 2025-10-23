/**
 * Request context that captures tracing and metadata for operations
 */
export interface RequestContext {
  correlationId: string; // generate at the edge if missing
  causationId?: string; // prior event id or message id
  requestId?: string; // http trace id
  ip?: string;
  userAgent?: string;
  source?: string; // 'http' | 'worker' | 'scheduler' | custom values
}
