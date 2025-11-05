import { Injectable } from '@nestjs/common';
import {
  ResolveOptions,
  SecretRef,
  SecretRefError,
  SecretResolutionContext,
} from '../secret-ref.types';

@Injectable()
export class PolicyGuard {
  private requestCounts = new Map<
    string,
    { count: number; windowStart: number }
  >();

  ensureAllowed(
    ref: SecretRef,
    opts: ResolveOptions | undefined,
    ctx?: SecretResolutionContext,
  ) {
    // Tenant isolation
    if (ctx && ref.tenant !== ctx.tenantId) {
      throw new SecretRefError('tenant mismatch', 'POLICY_DENIED', ref);
    }

    // Namespace controls (example): only same bounded context may resolve its namespace
    if (ctx && ref.namespace !== ctx.boundedContext) {
      throw new SecretRefError('namespace not allowed', 'POLICY_DENIED', ref);
    }

    // Require fixed versions in prod unless explicitly allowed
    if (
      ctx?.environment === 'production' &&
      opts?.requireVersion &&
      !ref.version
    ) {
      throw new SecretRefError(
        'pinned version required in production',
        'POLICY_DENIED',
        ref,
      );
    }

    // Rate limiting
    if (ctx?.rateLimitConfig) {
      this.checkRateLimit(ref, ctx);
    }
  }

  private checkRateLimit(ref: SecretRef, ctx: SecretResolutionContext) {
    const key = `${ref.tenant}:${ref.namespace}`;
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const config = ctx.rateLimitConfig!;

    const current = this.requestCounts.get(key);
    if (!current || now - current.windowStart > windowMs) {
      this.requestCounts.set(key, { count: 1, windowStart: now });
      return;
    }

    if (current.count >= config.maxRequestsPerMinute) {
      throw new SecretRefError(
        'rate limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        ref,
      );
    }

    current.count++;
  }
}
