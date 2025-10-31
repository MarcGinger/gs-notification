import { IUserToken } from '../../security/types';
import { SecurityMetadata } from '../../domain/events/event-metadata';

/**
 * Base command class with security context and metadata
 * All commands should extend this to ensure consistent security handling
 */
export abstract class BaseCommand {
  constructor(
    public readonly correlationId: string,
    public readonly user: IUserToken,
    public readonly securityContext: SecurityMetadata,
    public readonly timestamp: Date = new Date(),
  ) {}

  /**
   * Creates security metadata from user token
   */
  static createSecurityMetadata(
    user: IUserToken,
    additionalContext?: Partial<SecurityMetadata>,
  ): SecurityMetadata {
    return {
      userId: user.sub,
      tenant: user.tenant,
      sessionId: user.session_state,
      roles: user.roles || [],
      permissions: user.permissions || [],
      ...additionalContext,
    };
  }
}
