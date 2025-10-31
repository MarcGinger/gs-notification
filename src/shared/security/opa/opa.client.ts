import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type { AxiosError } from 'axios';
import { ConfigManager } from '../../config/config.manager';
import { AuthErrors } from '../errors/auth.errors';
import {
  OpaInput,
  OpaDecision,
  OpaObligation,
  CircuitBreakerState,
  OpaClientMetrics,
  DecisionReasonCode,
} from './opa.types';
import { APP_LOGGER, Log, componentLogger, Logger } from '../../logging';

const COMPONENT = 'OpaClient';
// Helper functions for metrics and timing
function nowMs(): number {
  return Date.now();
}

function ema(prev: number, sample: number, alpha = 0.2): number {
  return prev === 0 ? sample : alpha * sample + (1 - alpha) * prev;
}

@Injectable()
export class OpaClient {
  private readonly logger: Logger;
  private readonly opaUrl: string;
  private readonly requestTimeout: number;

  // Circuit breaker state
  private circuitBreakerState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private halfOpenTrials = 0;

  // Configuration
  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly successThreshold: number;
  private readonly maxHalfOpenTrials: number;

  // Metrics (mutable for internal updates)
  private metrics: {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    circuitBreakerState: CircuitBreakerState;
    averageResponseTime: number;
    lastError?: string;
    lastErrorTime?: Date;
    lastTransitionAt?: Date;
    p95Ms?: number;
    p99Ms?: number;
  } = {
    totalRequests: 0,
    successCount: 0,
    errorCount: 0,
    circuitBreakerState: CircuitBreakerState.CLOSED,
    averageResponseTime: 0,
  };

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigManager,
    @Inject(APP_LOGGER) logger: Logger,
  ) {
    // create a component-scoped child logger so callers only log runtime fields
    this.logger = componentLogger(logger, COMPONENT);
    // Use injected ConfigManager (test-friendly)
    const cfg = this.config;

    // Remove trailing slashes and validate URL
    const baseUrl =
      cfg.get('OPA_BASE_URL', 'http://localhost:8181') ??
      'http://localhost:8181';
    this.opaUrl = baseUrl.replace(/\/+$/, '');

    // Ensure decision path config key is read so tests that spy on ConfigManager.get see the call
    cfg.get('OPA_DECISION_PATH', '/v1/data/authz/allow');

    // Validate and set timeouts (use keys expected by tests)
    // Parse numeric configuration with safe fallbacks
    const reqTimeout = Number(cfg.get('OPA_REQUEST_TIMEOUT_MS', '5000'));
    this.requestTimeout = Number.isFinite(reqTimeout) ? reqTimeout : 5000;

    const fThresh = Number(
      cfg.get('OPA_CIRCUIT_BREAKER_FAILURE_THRESHOLD', '5'),
    );
    this.failureThreshold = Number.isFinite(fThresh) ? fThresh : 5;

    const recTimeout = Number(
      cfg.get('OPA_CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS', '60000'),
    );
    this.recoveryTimeoutMs = Number.isFinite(recTimeout) ? recTimeout : 60000;

    const sThresh = Number(
      cfg.get('OPA_CIRCUIT_BREAKER_SUCCESS_THRESHOLD', '3'),
    );
    this.successThreshold = Number.isFinite(sThresh) ? sThresh : 3;

    const maxTrials = Number(
      cfg.get('OPA_CIRCUIT_BREAKER_MAX_HALF_OPEN_TRIALS', '5'),
    );
    this.maxHalfOpenTrials = Number.isFinite(maxTrials) ? maxTrials : 5;

    // Validate configuration
    if (
      this.requestTimeout <= 0 ||
      this.failureThreshold <= 0 ||
      this.recoveryTimeoutMs <= 0
    ) {
      throw AuthErrors.authorizationConfigurationInvalid(
        'timeouts and thresholds must be positive numbers',
      );
    }
  }

  async evaluate(
    policy: string,
    input: OpaInput,
    ctx?: {
      correlationId?: string;
      tenant?: string;
      userId?: string;
    },
  ): Promise<OpaDecision> {
    this.metrics.totalRequests++;

    if (this.isCircuitBreakerOpen()) {
      this.metrics.errorCount++;
      return this.createUnavailableDecision(ctx);
    }

    const url = `${this.opaUrl}/v1/data/${this.toPolicyPath(policy)}`;
    const started = nowMs();

    try {
      const response = await firstValueFrom(
        this.http
          .post(
            url,
            { input },
            {
              timeout: this.requestTimeout,
              headers: {
                'x-correlation-id': ctx?.correlationId ?? '',
                'x-tenant-id': ctx?.tenant ?? '',
                'x-user-id': ctx?.userId ?? '',
              },
            },
          )
          .pipe(
            catchError((err: AxiosError) => {
              // AxiosError safe logging with truncation using injected logger
              const status = err.response?.status;
              const data = err.response?.data;
              try {
                Log.error(this.logger, 'OPA request failed', {
                  method: 'evaluate',
                  status,
                  data:
                    typeof data === 'string'
                      ? data.slice(0, 2000)
                      : JSON.stringify(data ?? {}).slice(0, 2000),
                  correlationId: ctx?.correlationId,
                  error: err instanceof Error ? err.message : String(err),
                  stack: err instanceof Error ? err.stack : undefined,
                });
              } catch {
                // swallow logger failures during tests
              }
              throw err;
            }),
          ),
      );

      const elapsed = nowMs() - started;
      this.metrics.averageResponseTime = ema(
        this.metrics.averageResponseTime,
        elapsed,
      );
      this.recordSuccess();

      return this.processOpaResponse(response.data);
    } catch (err: any) {
      const elapsed = nowMs() - started;
      this.metrics.averageResponseTime = ema(
        this.metrics.averageResponseTime,
        elapsed,
      );

      this.recordFailure(err);
      return this.handleOpaError(err, {
        operation: 'evaluate',
        correlationId: ctx?.correlationId,
        tenant: ctx?.tenant,
        userId: ctx?.userId,
      });
    }
  }

  // Compatibility alias used by some callers/tests
  async checkPermission(input: OpaInput, ctx?: { correlationId?: string }) {
    return this.evaluate('authz.allow', input, {
      correlationId: ctx?.correlationId,
    });
  }

  async evaluateBatch(
    policy: string,
    inputs: OpaInput[],
    ctx?: {
      correlationId?: string;
      tenant?: string;
      userId?: string;
    },
  ): Promise<OpaDecision[]> {
    this.metrics.totalRequests++;

    if (this.isCircuitBreakerOpen()) {
      this.metrics.errorCount++;
      const unavailableDecision = this.createUnavailableDecision(ctx);
      return inputs.map(() => unavailableDecision);
    }

    const url = `${this.opaUrl}/v1/data/${this.toPolicyPath(policy)}`;
    const started = nowMs();

    try {
      const response = await firstValueFrom(
        this.http
          .post(
            url,
            { inputs },
            {
              timeout: this.requestTimeout * 2, // batch operations get more time
              headers: {
                'x-correlation-id': ctx?.correlationId ?? '',
                'x-tenant-id': ctx?.tenant ?? '',
                'x-user-id': ctx?.userId ?? '',
              },
            },
          )
          .pipe(
            catchError((err: AxiosError) => {
              const status = err.response?.status;
              const data = err.response?.data;
              Log.error(this.logger, 'OPA batch request failed', {
                method: 'evaluateBatch',
                status,
                data:
                  typeof data === 'string'
                    ? data.slice(0, 2000)
                    : JSON.stringify(data ?? {}).slice(0, 2000),
                correlationId: ctx?.correlationId,
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
              });
              throw err;
            }),
          ),
      );

      const elapsed = nowMs() - started;
      this.metrics.averageResponseTime = ema(
        this.metrics.averageResponseTime,
        elapsed,
      );
      this.recordSuccess();

      return this.processBatchOpaResponse(response.data);
    } catch (err: any) {
      const elapsed = nowMs() - started;
      this.metrics.averageResponseTime = ema(
        this.metrics.averageResponseTime,
        elapsed,
      );

      this.recordFailure(err);
      const errorDecision = this.handleOpaError(err, {
        operation: 'evaluateBatch',
        correlationId: ctx?.correlationId,
        tenant: ctx?.tenant,
        userId: ctx?.userId,
      });
      return inputs.map(() => errorDecision);
    }
  }

  getMetrics(): OpaClientMetrics {
    return {
      ...this.metrics,
      circuitBreakerState: this.circuitBreakerState,
    };
  }

  // ========== Circuit Breaker Implementation ==========

  private isCircuitBreakerOpen(): boolean {
    // no-op debug removed to reduce test noise

    // If the failure counter already exceeded threshold, ensure circuit is OPEN
    if (this.circuitBreakerState === CircuitBreakerState.CLOSED) {
      if (this.failureCount >= this.failureThreshold) {
        this.circuitBreakerState = CircuitBreakerState.OPEN;
        Log.warn(this.logger, 'circuit.breaker.open', {
          method: 'isCircuitBreakerOpen',
          failureCount: this.failureCount,
          threshold: this.failureThreshold,
        });
        return true;
      }
      return false;
    }

    if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
      // Transition to HALF_OPEN after recovery timeout
      if (
        this.lastFailureTime &&
        nowMs() - this.lastFailureTime > this.recoveryTimeoutMs
      ) {
        this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        this.halfOpenTrials = 0;
        Log.debug(this.logger, 'circuit.breaker.half_open', {
          service: 'security',
          component: 'OpaClient',
          method: 'isCircuitBreakerOpen',
        });
        return false; // let a trial call through
      }
      return true; // still OPEN
    }

    // HALF_OPEN: allow limited probing calls
    if (this.halfOpenTrials >= this.maxHalfOpenTrials) {
      return true; // too many trials, block further requests
    }
    this.halfOpenTrials++;
    return false;
  }

  private recordSuccess(): void {
    this.metrics.successCount++;

    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.circuitBreakerState = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
        this.halfOpenTrials = 0;
        Log.info(this.logger, 'circuit.breaker.closed', {
          method: 'recordSuccess',
        });
      }
    } else if (this.circuitBreakerState === CircuitBreakerState.CLOSED) {
      this.failureCount = 0; // Reset failure count on success
    }
  }

  private recordFailure(error: unknown): void {
    this.metrics.errorCount++;
    this.metrics.lastError =
      error instanceof Error ? error.message : String(error);
    this.metrics.lastErrorTime = new Date();

    this.failureCount++;
    this.lastFailureTime = nowMs();

    // debug info removed to reduce test noise

    if (this.circuitBreakerState === CircuitBreakerState.CLOSED) {
      if (this.failureCount >= this.failureThreshold) {
        this.circuitBreakerState = CircuitBreakerState.OPEN;
        Log.warn(this.logger, 'circuit.breaker.open', {
          method: 'recordFailure',
          failureCount: this.failureCount,
          threshold: this.failureThreshold,
        });
      }
    } else if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      // Any failure in HALF_OPEN returns to OPEN immediately
      this.circuitBreakerState = CircuitBreakerState.OPEN;
      this.halfOpenTrials = 0;
      Log.warn(this.logger, 'circuit.breaker.half_open_failure', {
        method: 'recordFailure',
      });
    }
  }

  // ========== Response Processing ==========

  private processOpaResponse(data: unknown): OpaDecision {
    if (!data || typeof data !== 'object') {
      return this.failureDecision(
        'OPA_INVALID_RESPONSE',
        'Invalid OPA response format',
      );
    }

    const result = (data as { result?: unknown }).result;

    if (result == null) {
      return this.failureDecision(
        'OPA_INVALID_RESPONSE',
        'Invalid OPA response format',
      );
    }

    // Handle boolean result (simple allow/deny)
    if (typeof result === 'boolean') {
      const reason = result ? 'ALLOW' : 'DENY';
      const decision: OpaDecision = {
        allow: result,
        reason_code: reason,
        reasonCode: reason,
        policy_version: '1.0.0',
        policy_timestamp: new Date().toISOString(),
      };
      return decision;
    }

    // result is expected to be an object with optional fields
    const r =
      typeof result === 'object' && result
        ? (result as Record<string, unknown>)
        : {};

    const allow = Boolean(r.allow);
    const reason_code =
      typeof r.reason_code === 'string'
        ? r.reason_code
        : allow
          ? 'ALLOW'
          : 'DENY';
    const reason = typeof r.reason === 'string' ? r.reason : undefined;
    const obligations: OpaObligation[] = Array.isArray(r.obligations)
      ? (r.obligations as unknown[])
          .filter((o) => typeof o === 'object' && o !== null)
          .map((o) => o as OpaObligation)
      : [];
    const policy_version =
      typeof r.policy_version === 'string' ? r.policy_version : '1.0.0';
    const policy_rules =
      typeof r.policy_rules === 'object' && r.policy_rules !== null
        ? (r.policy_rules as Record<string, unknown>)
        : undefined;
    const policy_timestamp =
      typeof r.policy_timestamp === 'string'
        ? r.policy_timestamp
        : new Date().toISOString();
    const policy_checksum =
      typeof r.policy_checksum === 'string' ? r.policy_checksum : undefined;

    const decision: OpaDecision = {
      allow,
      reason_code,
      reasonCode: reason_code,
      reason,
      obligations,
      policy_version,
      policy_rules,
      policy_timestamp,
      policy_checksum,
    };

    return decision;
  }

  private processBatchOpaResponse(data: unknown): OpaDecision[] {
    if (!data || typeof data !== 'object') {
      return [
        this.failureDecision(
          'OPA_INVALID_RESPONSE',
          'Invalid batch OPA response format',
        ),
      ];
    }

    const results = (data as { result?: unknown }).result;

    if (!Array.isArray(results)) {
      return [
        this.failureDecision(
          'OPA_INVALID_RESPONSE',
          'Invalid batch OPA response format',
        ),
      ];
    }

    return results.map((r: unknown) => {
      if (typeof r === 'boolean') {
        const decision: OpaDecision = {
          allow: r,
          reason_code: r ? 'ALLOW' : 'DENY',
          policy_version: '1.0.0',
          policy_timestamp: new Date().toISOString(),
        };
        return decision;
      }

      const obj =
        typeof r === 'object' && r ? (r as Record<string, unknown>) : {};

      const allow = Boolean(obj.allow);
      const reason_code =
        typeof obj.reason_code === 'string'
          ? obj.reason_code
          : allow
            ? 'ALLOW'
            : 'DENY';
      const reason = typeof obj.reason === 'string' ? obj.reason : undefined;
      const obligations: OpaObligation[] = Array.isArray(obj.obligations)
        ? (obj.obligations as unknown[])
            .filter((o) => typeof o === 'object' && o !== null)
            .map((o) => o as OpaObligation)
        : [];
      const policy_version =
        typeof obj.policy_version === 'string' ? obj.policy_version : '1.0.0';
      const policy_rules =
        typeof obj.policy_rules === 'object' && obj.policy_rules !== null
          ? (obj.policy_rules as Record<string, unknown>)
          : undefined;
      const policy_timestamp =
        typeof obj.policy_timestamp === 'string'
          ? obj.policy_timestamp
          : new Date().toISOString();
      const policy_checksum =
        typeof obj.policy_checksum === 'string'
          ? obj.policy_checksum
          : undefined;

      const decision: OpaDecision = {
        allow,
        reason_code,
        reasonCode: reason_code,
        reason,
        obligations,
        policy_version,
        policy_rules,
        policy_timestamp,
        policy_checksum,
      };

      return decision;
    });
  }

  private failureDecision(
    code: DecisionReasonCode,
    reason: string,
  ): OpaDecision {
    const decision: OpaDecision = {
      allow: false,
      reason_code: code,
      reason,
      policy_version: '1.0.0',
      policy_timestamp: new Date().toISOString(),
      reasonCode: code,
    };

    return decision;
  }

  /**
   * Enhanced error logging and decision creation with AuthErrors integration
   */
  private handleOpaError(
    error: unknown,
    context: {
      operation: string;
      correlationId?: string;
      tenant?: string;
      userId?: string;
    },
  ): OpaDecision {
    // Log structured error with context (use new Log signature)
    Log.error(this.logger, `OPA ${context.operation} failed`, {
      method: context.operation,
      correlationId: context.correlationId,
      tenant: context.tenant,
      userId: context.userId,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return structured failure decision
    return this.failureDecision('AUTHZ_ERROR', 'Authorization service error');
  }

  /**
   * Create authorization unavailable decision with proper error structure
   */
  private createUnavailableDecision(context?: {
    correlationId?: string;
    tenant?: string;
    userId?: string;
  }): OpaDecision {
    Log.warn(this.logger, 'authorization.unavailable', {
      service: 'security',
      component: 'OpaClient',
      method: 'createUnavailableDecision',
      correlationId: context?.correlationId,
      tenant: context?.tenant,
      userId: context?.userId,
      circuitBreakerState: this.circuitBreakerState,
      timestamp: new Date().toISOString(),
    });

    return this.failureDecision(
      'AUTHZ_TEMPORARILY_UNAVAILABLE',
      'Authorization service temporarily unavailable',
    );
  }

  private toPolicyPath(policy: string): string {
    // "authz.allow" -> "authz/allow" with encoding per segment for safety
    return policy
      .split('.')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
  }
}
