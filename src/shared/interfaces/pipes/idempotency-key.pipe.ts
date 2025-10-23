import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { withContext } from '../../errors/error.types';
import { ValidationErrors } from './validation.errors';

export interface IdempotencyKeyOptions {
  maxLength?: number; // default 128
  allowed?: RegExp; // default: visible ASCII only
  rejectTrimmedChange?: boolean; // default true (don’t silently trim)
}

const DEFAULT_ALLOWED = /^[\x20-\x7E]+$/; // visible ASCII (no control chars)

@Injectable()
export class IdempotencyKeyPipe
  implements PipeTransform<string | string[] | undefined, string | undefined>
{
  constructor(private readonly opts: IdempotencyKeyOptions = {}) {}

  transform(value: string | string[] | undefined): string | undefined {
    if (value == null) return undefined;

    const raw = Array.isArray(value) ? value[0] : value;
    const {
      maxLength = 128,
      allowed = DEFAULT_ALLOWED,
      rejectTrimmedChange = true,
    } = this.opts;

    // Reject leading/trailing whitespace if configured
    if (rejectTrimmedChange && raw !== raw.trim()) {
      this.throwBadRequest(
        ValidationErrors.IDEMPOTENCY_KEY_INVALID_CHARACTERS,
        { field: 'idempotencyKey', reason: 'leading_or_trailing_whitespace' },
      );
    }

    const key = rejectTrimmedChange ? raw : raw.trim();

    if (key.length === 0) return undefined; // treat empty as absent (optional)
    if (key.length > maxLength) {
      this.throwBadRequest(ValidationErrors.IDEMPOTENCY_KEY_TOO_LONG, {
        field: 'idempotencyKey',
        maxLength,
        reason: 'too_long',
      });
    }

    if (!allowed.test(key)) {
      this.throwBadRequest(
        ValidationErrors.IDEMPOTENCY_KEY_INVALID_CHARACTERS,
        { field: 'idempotencyKey', reason: 'invalid_characters' },
      );
    }

    return key;
  }

  private throwBadRequest(
    code: (typeof ValidationErrors)[keyof typeof ValidationErrors],
    ctx: Record<string, unknown>,
  ): never {
    const domainErr = withContext(code, ctx);
    // If you have a ProblemDetails exception class, throw that instead.
    throw new BadRequestException({
      message: domainErr.title,
      code: domainErr.code,
      context: domainErr.context,
    });
  }
}
