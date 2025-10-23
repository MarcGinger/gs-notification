import { DomainError } from 'src/shared/errors';

/**
 * Context information for health check errors
 */
export interface HealthContext extends Record<string, unknown> {
  service?: string;
  endpoint?: string;
  responseTime?: number;
  baseUrl?: string;
}

/**
 * Health check error catalog
 *
 * Provides standardized errors for health monitoring and service availability checks.
 */
export const HealthErrors = {
  /**
   * Service is unreachable or not responding
   */
  SERVICE_UNAVAILABLE: {
    code: 'HEALTH.SERVICE_UNAVAILABLE',
    title: 'Service Unavailable',
    detail: 'The service is not reachable or not responding to health checks',
    category: 'infrastructure',
    retryable: true,
  } as DomainError<'HEALTH.SERVICE_UNAVAILABLE', HealthContext>,

  /**
   * Service responded but failed health validation
   */
  SERVICE_UNHEALTHY: {
    code: 'HEALTH.SERVICE_UNHEALTHY',
    title: 'Service Unhealthy',
    detail: 'The service is responding but reported an unhealthy state',
    category: 'infrastructure',
    retryable: true,
  } as DomainError<'HEALTH.SERVICE_UNHEALTHY', HealthContext>,

  /**
   * Health check timeout
   */
  HEALTH_CHECK_TIMEOUT: {
    code: 'HEALTH.HEALTH_CHECK_TIMEOUT',
    title: 'Health Check Timeout',
    detail: 'The health check operation timed out',
    category: 'infrastructure',
    retryable: true,
  } as DomainError<'HEALTH.HEALTH_CHECK_TIMEOUT', HealthContext>,

  /**
   * Invalid health check response
   */
  INVALID_HEALTH_RESPONSE: {
    code: 'HEALTH.INVALID_HEALTH_RESPONSE',
    title: 'Invalid Health Response',
    detail: 'The health check response format is invalid or unexpected',
    category: 'infrastructure',
    retryable: false,
  } as DomainError<'HEALTH.INVALID_HEALTH_RESPONSE', HealthContext>,

  /**
   * OPA-specific: Decision probe failed
   */
  OPA_DECISION_PROBE_FAILED: {
    code: 'HEALTH.OPA_DECISION_PROBE_FAILED',
    title: 'OPA Decision Probe Failed',
    detail: 'The OPA decision endpoint did not return the expected result',
    category: 'infrastructure',
    retryable: true,
  } as DomainError<'HEALTH.OPA_DECISION_PROBE_FAILED', HealthContext>,

  /**
   * Redis-specific: Unexpected ping response
   */
  REDIS_UNEXPECTED_PING_RESPONSE: {
    code: 'HEALTH.REDIS_UNEXPECTED_PING_RESPONSE',
    title: 'Redis Unexpected Ping Response',
    detail: 'Redis ping command returned an unexpected response',
    category: 'infrastructure',
    retryable: true,
  } as DomainError<'HEALTH.REDIS_UNEXPECTED_PING_RESPONSE', HealthContext>,

  /**
   * Redis-specific: Connection failed
   */
  REDIS_CONNECTION_FAILED: {
    code: 'HEALTH.REDIS_CONNECTION_FAILED',
    title: 'Redis Connection Failed',
    detail: 'Unable to establish or maintain connection to Redis',
    category: 'infrastructure',
    retryable: true,
  } as DomainError<'HEALTH.REDIS_CONNECTION_FAILED', HealthContext>,
};
