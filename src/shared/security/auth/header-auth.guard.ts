import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthErrors } from '../errors/auth.errors';

/**
 * Header validation guard for early, friendly errors
 * Validates Authorization header format before delegating to JwtAuthGuard
 *
 * Use with: @UseGuards(HeaderAuthGuard, JwtAuthGuard)
 */
@Injectable()
export class HeaderAuthGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const rawAuth = req.headers?.authorization;

    if (!rawAuth) throw AuthErrors.missingAuthorizationHeader();

    if (typeof rawAuth !== 'string') {
      // If header is present but not a single string, treat as invalid
      throw AuthErrors.invalidAuthorizationHeader();
    }

    const auth = rawAuth;
    if (!auth.startsWith('Bearer ')) {
      throw AuthErrors.invalidAuthorizationHeader();
    }

    const token = auth.slice(7);
    if (!token) throw AuthErrors.missingToken();

    return true; // Let the JwtAuthGuard/Passport handle signature & claims
  }
}
