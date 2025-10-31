import { ActorContext } from '../application/context/actor-context';
import { IUserToken } from '../security';
import { DomainError, Result, ok, err, withContext } from '../errors';

/**
 * ActorContext Utility Error Definitions
 * Defines all errors that can occur during ActorContext operations
 */
const ActorContextErrorDefinitions = {
  INVALID_USER_TOKEN: {
    title: 'Invalid User Token',
    detail: 'User token is missing or invalid',
    category: 'validation' as const,
    retryable: false,
  },

  INVALID_ACTOR_CONTEXT: {
    title: 'Invalid ActorContext',
    detail: 'Failed to create valid ActorContext from user token',
    category: 'validation' as const,
    retryable: false,
  },
} as const;

/**
 * ActorContext error catalog with namespaced error codes
 */
const ActorContextErrors = Object.fromEntries(
  Object.entries(ActorContextErrorDefinitions).map(([key, errorDef]) => {
    const code = `ACTOR_CONTEXT.${key}` as const;
    return [key, { ...errorDef, code }];
  }),
) as {
  [K in keyof typeof ActorContextErrorDefinitions]: DomainError<`ACTOR_CONTEXT.${Extract<K, string>}`>;
};

/**
 * Utility functions for ActorContext conversion and manipulation
 */
export class ActorContextUtil {
  /**
   * Safe conversion from IUserToken to ActorContext (Result pattern)
   * @param user - The JWT user token from authentication
   * @returns Result containing ActorContext or validation error
   */
  static fromUserTokenSafe(
    user: IUserToken,
  ): Result<ActorContext, DomainError> {
    if (!user) {
      return err(
        withContext(ActorContextErrors.INVALID_USER_TOKEN, {
          operation: 'ActorContextUtil.fromUserToken',
          reason: 'User token is null or undefined',
          hasUser: false,
        }),
      );
    }

    if (!user.sub) {
      return err(
        withContext(ActorContextErrors.INVALID_USER_TOKEN, {
          operation: 'ActorContextUtil.fromUserToken',
          reason: 'User token missing subject (sub) field',
          hasUser: true,
          userSubject: user.sub,
        }),
      );
    }

    const actor: ActorContext = {
      userId: user.sub,
      tenant: user.tenant,
      tenant_userId: user.tenant_id || '',
      username: user.email,
      roles: user.roles,
    };

    return ok(actor);
  }

  /**
   * Validates that an ActorContext has required fields
   * @param actor - The actor context to validate
   * @returns boolean indicating if the actor context is valid
   */
  static isValid(actor: ActorContext): boolean {
    return Boolean(actor && actor.userId);
  }

  /**
   * Safe validation and creation of ActorContext (Result pattern)
   * @param user - The JWT user token from authentication
   * @returns Result containing validated ActorContext or error details
   */
  static createValidatedSafe(
    user: IUserToken,
  ): Result<ActorContext, DomainError> {
    if (!user || !user.sub) {
      return err(
        withContext(ActorContextErrors.INVALID_USER_TOKEN, {
          operation: 'ActorContextUtil.createValidated',
          reason: 'Missing subject (sub) in user token',
          hasUser: Boolean(user),
          userSubject: user?.sub,
        }),
      );
    }

    const actorResult = ActorContextUtil.fromUserTokenSafe(user);
    if (!actorResult.ok) {
      return actorResult; // Forward the error from fromUserTokenSafe
    }
    const actor = actorResult.value;

    if (!ActorContextUtil.isValid(actor)) {
      return err(
        withContext(ActorContextErrors.INVALID_ACTOR_CONTEXT, {
          operation: 'ActorContextUtil.createValidated',
          reason: 'Generated ActorContext failed validation',
          userId: actor.userId,
          tenant: actor.tenant,
          hasRoles: Boolean(actor.roles),
        }),
      );
    }

    return ok(actor);
  }

  /**
   * Extracts tenant ID from ActorContext with fallback
   * @param actor - The actor context
   * @param fallback - Fallback tenant ID if not present
   * @returns The tenant ID or fallback
   */
  static getTenantId(
    actor: ActorContext,
    fallback: string = 'default',
  ): string {
    return actor.tenant || fallback;
  }

  /**
   * Safe role checking with validation (Result pattern)
   * @param actor - The actor context
   * @param role - The role to check for
   * @returns Result containing boolean or validation error
   */
  static hasRoleSafe(
    actor: ActorContext,
    role: string,
  ): Result<boolean, DomainError> {
    if (!actor) {
      return err(
        withContext(ActorContextErrors.INVALID_ACTOR_CONTEXT, {
          operation: 'ActorContextUtil.hasRole',
          reason: 'ActorContext is null or undefined',
          role,
        }),
      );
    }

    if (!role) {
      return err(
        withContext(ActorContextErrors.INVALID_ACTOR_CONTEXT, {
          operation: 'ActorContextUtil.hasRole',
          reason: 'Role parameter is empty or undefined',
          userId: actor.userId,
          role,
        }),
      );
    }

    const hasRole = Boolean(actor.roles?.includes(role));
    return ok(hasRole);
  }

  /**
   * Safe role checking for multiple roles with validation (Result pattern)
   * @param actor - The actor context
   * @param roles - Array of roles to check for
   * @returns Result containing boolean or validation error
   */
  static hasAnyRoleSafe(
    actor: ActorContext,
    roles: string[],
  ): Result<boolean, DomainError> {
    if (!actor) {
      return err(
        withContext(ActorContextErrors.INVALID_ACTOR_CONTEXT, {
          operation: 'ActorContextUtil.hasAnyRole',
          reason: 'ActorContext is null or undefined',
          requestedRoles: roles,
        }),
      );
    }

    if (!Array.isArray(roles)) {
      return err(
        withContext(ActorContextErrors.INVALID_ACTOR_CONTEXT, {
          operation: 'ActorContextUtil.hasAnyRole',
          reason: 'Roles parameter is not an array',
          userId: actor.userId,
          rolesType: typeof roles,
        }),
      );
    }

    if (!actor.roles || !roles.length) {
      return ok(false);
    }

    const hasAnyRole = roles.some((role) => actor.roles!.includes(role));
    return ok(hasAnyRole);
  }
}
