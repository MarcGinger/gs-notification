import { Result, ok, err, DomainError, withContext } from 'src/shared/errors';
import { Log, Logger } from 'src/shared/logging';
import { EventMetadata } from 'src/shared/domain/events';
import { Clock } from 'src/shared/infrastructure/time';
import { ActorContextUtil } from 'src/shared/utilities/actor-context.util';
import { IUserToken } from 'src/shared/security';

/**
 * Shared utility functions for use cases across all domains.
 * These utilities provide common patterns for logging, validation, and metadata handling.
 * All functions accept serviceName as a parameter to remain domain-agnostic.
 */

type UserToken = IUserToken;

type BaseCommand<TProps> = {
  correlationId: string;
  user: UserToken;
  props?: TProps;
};

/**
 * Build standardized event metadata for domain events
 * @param cmd - Command with correlation ID and user token
 * @param clock - Clock instance for timestamps
 * @param source - Event source identifier
 * @param serviceName - Name of the service (domain-specific)
 */
export const buildEventMetadata = (
  cmd: { correlationId: string; user: UserToken },
  clock: Clock,
  source: string,
  serviceName: string,
): EventMetadata => ({
  actor: {
    userId: cmd.user.sub,
    tenant: cmd.user.tenant,
    tenant_userId: cmd.user.tenant_id || '',
    username: cmd.user.email || '',
    roles: cmd.user.roles ?? [],
  },
  correlationId: cmd.correlationId,
  service: serviceName,
  timestampIso: clock.nowIso(),
  source,
  eventVersion: '1.0.0',
  schemaVersion: '2025.1',
  dataClassification: 'internal',
});

/**
 * Validate that required props exist on command
 * @param command - Base command with props
 * @param makeError - Function to create domain error
 * @param ctx - Context with operation name
 * @param logger - Logger instance
 * @param serviceName - Name of the service (domain-specific)
 */
export function ensureProps<TProps>(
  command: BaseCommand<TProps>,
  makeError: () => DomainError,
  ctx: { operation: string },
  logger: Logger,
  serviceName: string,
): Result<TProps, DomainError> {
  if (command.props == null) {
    Log.warn(logger, 'Missing props structure', {
      application: serviceName,
      component: ctx.operation,
      method: 'execute',
      correlationId: command.correlationId,
      userId: command.user.sub,
      reason: 'PROPS_MISSING',
    });
    return err(
      withContext(makeError(), {
        correlationId: command.correlationId,
        userId: command.user.sub,
        operation: `${ctx.operation}_technical_validation`,
        validationFailure: 'PROPS_STRUCTURE_MISSING',
        providedProps: command.props,
        expectedStructure: 'Props object with required fields',
        reason: 'Command props is null or undefined',
      }),
    );
  }
  return ok(command.props);
}

/**
 * Get actor from user token with error handling
 * @param command - Command with user token and correlation ID
 */
export function getActorOrErr(command: {
  user: UserToken;
  correlationId: string;
}): Result<
  ReturnType<typeof ActorContextUtil.fromUserTokenSafe> extends Result<
    infer A,
    any
  >
    ? A
    : never,
  DomainError
> {
  const r = ActorContextUtil.fromUserTokenSafe(command.user);
  return r.ok ? ok(r.value) : err(r.error);
}

/**
 * Validate foreign keys using provided validator
 * @param fkValidator - Foreign key validator service
 * @param actor - Actor performing the action
 * @param props - Props to validate
 * @param context - Validation context
 * @param logger - Logger instance
 */
export async function validateForeignKeysOrErr<TProps>(
  fkValidator: {
    validateForeignKeys: (
      actor: any,
      props: TProps,
      validationContext: any,
      logger: Logger,
    ) => Promise<Result<void, DomainError>>;
  },
  actor: any,
  props: TProps,
  context: {
    correlationId: string;
    userId: string;
    operation: string;
    component: string;
  },
  logger: Logger,
): Promise<Result<void, DomainError>> {
  return fkValidator.validateForeignKeys(actor, props, context, logger);
}

/**
 * Save aggregate with error handling
 * @param repo - Repository with save method
 * @param actor - Actor performing the action
 * @param agg - Aggregate to save
 * @param ctx - Context with correlation info
 */
export async function saveAggregateOrErr<
  TAggregate extends { id: { value: string } },
>(
  repo: {
    save: (actor: any, agg: TAggregate) => Promise<Result<void, DomainError>>;
  },
  actor: any,
  agg: TAggregate,
  ctx: { correlationId: string; userId: string; operation: string },
): Promise<Result<void, DomainError>> {
  const r = await repo.save(actor, agg);
  return r.ok
    ? ok(undefined)
    : err(
        withContext(r.error, {
          correlationId: ctx.correlationId,
          userId: ctx.userId,
          operation: ctx.operation,
          entityId: agg.id.value,
        }),
      );
}

/**
 * Log the start of a use case execution
 * @param logger - Logger instance
 * @param component - Component name
 * @param method - Method name
 * @param cmd - Command being executed
 * @param serviceName - Name of the service (domain-specific)
 */
export function startLog(
  logger: Logger,
  component: string,
  method: string,
  cmd: { correlationId: string; user: UserToken; props?: unknown },
  serviceName: string,
) {
  Log.info(logger, `Executing ${component}`, {
    application: serviceName,
    component,
    method,
    correlationId: cmd.correlationId,
    userId: cmd.user.sub,
    propsKeys: Object.keys(cmd.props || {}),
    repositoryFeatures: {
      cachingEnabled: true,
      metricsEnabled: true,
      healthMonitoringEnabled: true,
    },
  });
}

/**
 * Log pre-validation step
 * @param logger - Logger instance
 * @param component - Component name
 * @param method - Method name
 * @param cmd - Command being executed
 * @param serviceName - Name of the service (domain-specific)
 */
export function prevalidateLog(
  logger: Logger,
  component: string,
  method: string,
  cmd: { correlationId: string; user: UserToken },
  serviceName: string,
) {
  Log.debug(logger, 'Performing technical pre-validation', {
    application: serviceName,
    component,
    method,
    correlationId: cmd.correlationId,
    userId: cmd.user.sub,
    operation: `${component.replace(/UseCase$/, '').toLowerCase()}_pre_validation`,
  });
}

/**
 * Log successful use case execution
 * @param logger - Logger instance
 * @param component - Component name
 * @param method - Method name
 * @param cmd - Command that was executed
 * @param entityId - ID of the affected entity
 * @param op - Operation that was performed
 * @param serviceName - Name of the service (domain-specific)
 */
export function successLog(
  logger: Logger,
  component: string,
  method: string,
  cmd: { correlationId: string; user: UserToken },
  entityId: string,
  op: string,
  serviceName: string,
) {
  Log.info(logger, `${component} executed successfully`, {
    application: serviceName,
    component,
    method,
    correlationId: cmd.correlationId,
    userId: cmd.user.sub,
    operation: op,
    entityId,
  });
}
