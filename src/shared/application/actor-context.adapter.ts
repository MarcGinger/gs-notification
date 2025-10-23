import { IUserToken } from '../security';
import { ActorContext } from './context/actor-context';

/**
 * Shared utility for converting user authentication tokens to actor contexts
 *
 * This utility provides a consistent way to transform authentication tokens
 * into actor contexts across all use cases and application services.
 *
 * @domain Shared - Application Utilities
 * @layer Application
 * @pattern Adapter Pattern
 */
export class ActorContextAdapter {
  /**
   * Convert IUserToken to ActorContext for repository operations
   *
   * @param user - The authenticated user token from the security layer
   * @returns ActorContext suitable for repository and domain operations
   */
  static fromUserToken(user: IUserToken): ActorContext {
    return {
      userId: user.sub,
      tenantId: user.tenant,
      roles: user.roles,
    };
  }

  /**
   * Validate that the actor context has required fields
   *
   * @param actor - The actor context to validate
   * @returns true if valid, false otherwise
   */
  static isValid(actor: ActorContext): boolean {
    return !!(actor.userId && actor.tenantId);
  }

  /**
   * Create a sanitized version for logging (removes sensitive data)
   *
   * @param actor - The actor context
   * @returns Sanitized context safe for logging
   */
  static toLogContext(actor: ActorContext): Record<string, unknown> {
    return {
      userId: actor.userId,
      tenantId: actor.tenantId,
      roleCount: actor.roles?.length || 0,
    };
  }
}
