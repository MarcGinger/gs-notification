import { BaseCommand } from 'src/shared/application/commands/base.command';
import { IUserToken } from 'src/shared/security';
import { CorrelationUtil } from 'src/shared/utilities/correlation.util';
import { SecurityMetadata } from 'src/shared/domain/events/event-metadata';
import { RecordMessageFailedProps } from '../../domain/props';

/**
 * Enhanced Record Message Failed Command with security context and metadata
 */
export class RecordMessageFailedCommand extends BaseCommand {
  constructor(
    user: IUserToken,
    public readonly props: RecordMessageFailedProps,
    correlationId: string,
    securityContext: SecurityMetadata,
  ) {
    super(correlationId, user, securityContext);
  }

  /**
   * Factory method to create command with automatic security context
   */
  static create(
    user: IUserToken,
    props: RecordMessageFailedProps,
    correlationId: string = CorrelationUtil.generate(),
    additionalSecurityContext?: Partial<SecurityMetadata>,
  ): RecordMessageFailedCommand {
    const securityContext = BaseCommand.createSecurityMetadata(
      user,
      additionalSecurityContext,
    );

    return new RecordMessageFailedCommand(
      user,
      props,
      correlationId,
      securityContext,
    );
  }
}
