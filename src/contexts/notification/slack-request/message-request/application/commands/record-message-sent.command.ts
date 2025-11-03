import { BaseCommand } from 'src/shared/application/commands/base.command';
import { IUserToken } from 'src/shared/security';
import { CorrelationUtil } from 'src/shared/utilities/correlation.util';
import { SecurityMetadata } from 'src/shared/domain/events/event-metadata';
import { RecordMessageSentProps } from '../../domain/props';

/**
 * Enhanced Record Message Sent Command with security context and metadata
 */
export class RecordMessageSentCommand extends BaseCommand {
  constructor(
    user: IUserToken,
    public readonly props: RecordMessageSentProps,
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
    props: RecordMessageSentProps,
    correlationId: string = CorrelationUtil.generate(),
    additionalSecurityContext?: Partial<SecurityMetadata>,
  ): RecordMessageSentCommand {
    const securityContext = BaseCommand.createSecurityMetadata(
      user,
      additionalSecurityContext,
    );

    return new RecordMessageSentCommand(
      user,
      props,
      correlationId,
      securityContext,
    );
  }
}
