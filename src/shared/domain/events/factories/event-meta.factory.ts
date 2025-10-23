import { randomUUID } from 'crypto';
import { EventMeta } from '..';
import { IUserToken } from '../../../security';

export function createEventMeta(params: {
  user: IUserToken;
  correlationId?: string;
  causationId?: string;
  commandId?: string;
  source?: string;
  schemaVersion?: number;
}): EventMeta {
  const { user, correlationId, causationId, commandId, source, schemaVersion } =
    params;

  return {
    eventId: randomUUID(),
    correlationId: correlationId ?? randomUUID(),
    causationId: causationId ?? '',
    commandId: commandId ?? '',
    tenant: user.tenant,
    user: user
      ? {
          id: user.sub,
          email: user.email,
          name: user.name,
        }
      : undefined,
    source: source ?? 'catalog.service',
    occurredAt: new Date().toISOString(),
    schemaVersion: schemaVersion ?? 1,
    contentType: 'application/json+domain',
  };
}

export default createEventMeta;
