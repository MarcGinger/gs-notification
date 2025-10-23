import { ActorContext } from '../context/actor-context';
import { RequestContext } from '../context/request-context';
import { EventMetadata } from '../../domain/events/event-metadata';

export interface Clock {
  now(): Date;
  nowIso(): string;
}

/**
 * Factory for creating consistent event metadata across all services
 * Centralizes the construction of metadata to ensure consistency
 */
export class MetadataFactory {
  constructor(
    private readonly serviceName: string,
    private readonly clock: Clock,
  ) {}

  /**
   * Map raw JWT token to ActorContext (done once, outside repositories)
   * This keeps JWT structure knowledge out of repositories and domain
   */
  toActorContext(token: {
    sub: string;
    tenant_id?: string;
    realm_access?: { roles?: string[] };
    resource_access?: Record<string, { roles?: string[] }>;
  }): ActorContext {
    const kcRoles =
      token?.realm_access?.roles ??
      Object.values(token?.resource_access ?? {}).flatMap((r) => r.roles ?? []);
    return {
      userId: token.sub,
      tenantId: token.tenant_id,
      roles: kcRoles?.slice(0, 20), // Limit roles for performance
    };
  }

  /**
   * Build complete event metadata from actor and request contexts
   * This method centralizes metadata construction to ensure consistency
   */
  build(
    actor: ActorContext,
    req: RequestContext,
    extras?: Record<string, unknown>,
  ): EventMetadata {
    return {
      actor: {
        userId: actor.userId,
        tenantId: actor.tenantId,
        roles: actor.roles,
      },
      correlationId: req.correlationId,
      causationId: req.causationId,
      requestId: req.requestId,
      source: req.source,
      service: this.serviceName,
      timestampIso: this.clock.nowIso(),
      ip: req.ip,
      userAgent: req.userAgent,
      eventVersion: '1.0.0', // Default version
      schemaVersion: '2025.1', // Current schema version
      ...(extras ?? {}),
    };
  }
}
