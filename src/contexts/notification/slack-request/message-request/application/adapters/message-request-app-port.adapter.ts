import { Injectable, Logger, Inject } from '@nestjs/common';
import { IMessageRequestAppPort } from '../ports/message-request-app.port';
import {
  IMessageRequestReader,
  IMessageRequestWriter,
  MESSAGE_REQUEST_READER_TOKEN,
  MESSAGE_REQUEST_WRITER_TOKEN,
} from '../ports';
import { MessageRequestAggregate } from '../../domain/aggregates/message-request.aggregate';
import { MessageRequestEntity } from '../../domain/entities/message-request.entity';
import { createMessageRequestId } from '../../domain/value-objects/id.vo';
import { ActorContext } from 'src/shared/application/context/actor-context';
import { EventMetadata } from 'src/shared/domain/events';
import { SystemClock } from 'src/shared/infrastructure/time';
import { Option } from 'src/shared/domain/types/option';

/**
 * Application Port Adapter for MessageRequest Outcomes
 *
 * Phase 2 Implementation: Uses domain aggregates and proper event sourcing
 * Records message delivery outcomes through domain layer with rich events.
 */
@Injectable()
export class MessageRequestAppPortAdapter implements IMessageRequestAppPort {
  private readonly logger = new Logger(MessageRequestAppPortAdapter.name);

  constructor(
    @Inject(MESSAGE_REQUEST_READER_TOKEN)
    private readonly reader: IMessageRequestReader,
    @Inject(MESSAGE_REQUEST_WRITER_TOKEN)
    private readonly writer: IMessageRequestWriter,
  ) {}

  /**
   * Record successful message delivery (Phase 2: Use domain aggregates)
   */
  async recordSent(input: {
    id: string;
    tenant: string;
    slackTs: string;
    slackChannel: string;
    attempts: number;
    correlationId?: string;
    causationId?: string;
    actor?: { userId: string; roles?: string[] };
  }): Promise<void> {
    this.logger.log(
      `Recording successful delivery for MessageRequest ${input.id}`,
      {
        messageRequestId: input.id,
        tenant: input.tenant,
        slackTs: input.slackTs,
        attempts: input.attempts,
        correlationId: input.correlationId,
      },
    );

    try {
      // Create message request ID value object
      const messageRequestIdResult = createMessageRequestId(input.id);
      if (!messageRequestIdResult.ok) {
        throw new Error(`Invalid MessageRequest ID: ${input.id}`);
      }

      // Create actor context
      const actor: ActorContext = {
        tenant: input.tenant,
        userId: input.actor?.userId || 'system',
        tenant_userId: input.actor?.userId || 'system',
        roles: input.actor?.roles || [],
      };

      // Load aggregate snapshot
      const snapshotResult = await this.reader.findById(
        actor,
        messageRequestIdResult.value,
      );
      if (!snapshotResult.ok) {
        throw new Error(
          `Failed to load MessageRequest ${input.id}: ${snapshotResult.error.code}`,
        );
      }

      if (!snapshotResult.value || Option.isNone(snapshotResult.value)) {
        throw new Error(`MessageRequest not found: ${input.id}`);
      }

      // Reconstitute entity from snapshot
      const entityResult = MessageRequestEntity.fromSnapshot(
        snapshotResult.value.value,
      );
      if (!entityResult.ok) {
        throw new Error(
          `Failed to reconstitute entity for MessageRequest ${input.id}: ${entityResult.error.code}`,
        );
      }

      // Create event metadata
      const eventMetadata: EventMetadata = {
        correlationId: input.correlationId || 'unknown',
        causationId: input.causationId,
        actor: {
          ...actor,
          sessionId: 'message-request-adapter',
        },
        service: 'notification-service',
        timestampIso: new SystemClock().nowIso(),
        eventVersion: '1.0.0',
        schemaVersion: '2023.1',
      };

      // Reconstitute aggregate from entity
      const aggregate = MessageRequestAggregate.reconstitute(
        entityResult.value,
        new SystemClock(),
        eventMetadata,
      );

      // Mark as sent using domain logic
      const sentResult = aggregate.markSent({
        tenant: input.tenant,
        slackTs: input.slackTs,
        slackChannel: input.slackChannel,
        attempts: input.attempts,
        correlationId: input.correlationId,
        causationId: input.causationId,
        actor: input.actor,
      });

      if (!sentResult.ok) {
        throw new Error(
          `Failed to mark MessageRequest as sent: ${sentResult.error.code}`,
        );
      }

      // Save aggregate (will emit domain events)
      const saveResult = await this.writer.save(actor, aggregate);
      if (!saveResult.ok) {
        throw new Error(
          `Failed to save MessageRequest ${input.id}: ${saveResult.error.code}`,
        );
      }

      this.logger.log(
        `Successfully recorded delivery for MessageRequest ${input.id} (Phase 2 - domain aggregates)`,
        {
          messageRequestId: input.id,
          slackTs: input.slackTs,
          phase: 'Phase2-DomainAggregates',
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to record delivery for MessageRequest ${input.id}`,
        {
          messageRequestId: input.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          correlationId: input.correlationId,
        },
      );
      throw error;
    }
  }

  /**
   * Record failed message delivery (Phase 2: Use domain aggregates)
   */
  async recordFailed(input: {
    id: string;
    tenant: string;
    reason: string;
    attempts: number;
    retryable?: boolean;
    lastError?: string;
    correlationId?: string;
    causationId?: string;
    actor?: { userId: string; roles?: string[] };
  }): Promise<void> {
    this.logger.log(
      `Recording failed delivery for MessageRequest ${input.id}`,
      {
        messageRequestId: input.id,
        tenant: input.tenant,
        reason: input.reason,
        attempts: input.attempts,
        retryable: input.retryable,
        correlationId: input.correlationId,
      },
    );

    try {
      // Create message request ID value object
      const messageRequestIdResult = createMessageRequestId(input.id);
      if (!messageRequestIdResult.ok) {
        throw new Error(`Invalid MessageRequest ID: ${input.id}`);
      }

      // Create actor context
      const actor: ActorContext = {
        tenant: input.tenant,
        userId: input.actor?.userId || 'system',
        tenant_userId: input.actor?.userId || 'system',
        roles: input.actor?.roles || [],
      };

      // Load aggregate snapshot
      const snapshotResult = await this.reader.findById(
        actor,
        messageRequestIdResult.value,
      );
      if (!snapshotResult.ok) {
        throw new Error(
          `Failed to load MessageRequest ${input.id}: ${snapshotResult.error.code}`,
        );
      }

      if (!snapshotResult.value || Option.isNone(snapshotResult.value)) {
        throw new Error(`MessageRequest not found: ${input.id}`);
      }

      // Reconstitute entity from snapshot
      const entityResult = MessageRequestEntity.fromSnapshot(
        snapshotResult.value.value,
      );
      if (!entityResult.ok) {
        throw new Error(
          `Failed to reconstitute entity for MessageRequest ${input.id}: ${entityResult.error.code}`,
        );
      }

      // Create event metadata
      const eventMetadata: EventMetadata = {
        correlationId: input.correlationId || 'unknown',
        causationId: input.causationId,
        actor: {
          ...actor,
          sessionId: 'message-request-adapter',
        },
        service: 'notification-service',
        timestampIso: new SystemClock().nowIso(),
        eventVersion: '1.0.0',
        schemaVersion: '2023.1',
      };

      // Reconstitute aggregate from entity
      const aggregate = MessageRequestAggregate.reconstitute(
        entityResult.value,
        new SystemClock(),
        eventMetadata,
      );

      // Mark as failed using domain logic
      const failedResult = aggregate.markFailed({
        tenant: input.tenant,
        reason: input.reason,
        attempts: input.attempts,
        retryable: input.retryable,
        lastError: input.lastError,
        correlationId: input.correlationId,
        causationId: input.causationId,
        actor: input.actor,
      });

      if (!failedResult.ok) {
        throw new Error(
          `Failed to mark MessageRequest as failed: ${failedResult.error.code}`,
        );
      }

      // Save aggregate (will emit domain events)
      const saveResult = await this.writer.save(actor, aggregate);
      if (!saveResult.ok) {
        throw new Error(
          `Failed to save MessageRequest ${input.id}: ${saveResult.error.code}`,
        );
      }

      this.logger.log(
        `Successfully recorded failure for MessageRequest ${input.id} (Phase 2 - domain aggregates)`,
        {
          messageRequestId: input.id,
          reason: input.reason,
          phase: 'Phase2-DomainAggregates',
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to record failure for MessageRequest ${input.id}`,
        {
          messageRequestId: input.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          correlationId: input.correlationId,
        },
      );
      throw error;
    }
  }
}
