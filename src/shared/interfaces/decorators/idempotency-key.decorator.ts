import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';

/**
 * Extracts Idempotency-Key (or x-idempotency-key) from request headers (case-insensitive).
 * Returns undefined when header is absent or empty. Validation happens in the Pipe.
 */
export const IdempotencyKey = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | string[] | undefined => {
    const req = ctx
      .switchToHttp()
      .getRequest<{ headers: IncomingHttpHeaders }>();
    const headers = req?.headers ?? {};

    // Node lowercases header names; check common variants explicitly
    for (const name of ['idempotency-key', 'x-idempotency-key'] as const) {
      const raw = headers[name];
      if (typeof raw === 'string') return raw.length ? raw : undefined;
      if (Array.isArray(raw)) {
        const first = raw[0];
        return first && first.length ? first : undefined;
      }
    }
    return undefined;
  },
);
