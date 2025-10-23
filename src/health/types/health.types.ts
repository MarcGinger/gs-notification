import { Result, DomainError } from 'src/shared/errors';
import { HealthIndicatorResult } from '@nestjs/terminus';

/**
 * Health check result with detailed information
 */
export interface HealthCheckDetails {
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  endpoints?: string[];
  details?: Record<string, any>;
  error?: string;
}

/**
 * Type alias for health check operations that may fail
 */
export type HealthResult<T = HealthCheckDetails> = Result<T, DomainError>;

/**
 * Type alias for NestJS Terminus health indicator results
 */
export type TerminusHealthResult = Result<HealthIndicatorResult, DomainError>;
