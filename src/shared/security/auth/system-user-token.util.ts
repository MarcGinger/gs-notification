/**
 * System User Token Utility
 *
 * Provides a generic, configurable way to create system user tokens for internal operations.
 * Supports multiple authentication providers (Keycloak client credentials, JWT, etc.)
 */

import { IUserToken } from '../types';

/**
 * System user configuration for different authentication providers
 */
export interface SystemUserConfig {
  /** Authentication provider type */
  provider: 'keycloak' | 'jwt' | 'internal';

  /** Default system user configuration */
  defaultUser: {
    name: string;
    email: string;
    roles: string[];
  };

  /** Keycloak-specific configuration */
  keycloak?: {
    clientId: string;
    realm: string;
    serviceAccountRoles?: string[];
  };

  /** JWT configuration */
  jwt?: {
    issuer: string;
    audience: string;
    defaultTtlHours: number;
  };

  /** Internal system configuration */
  internal?: {
    systemPrefix: string;
    defaultTtlHours: number;
  };
}

/**
 * Actor context for system operations
 */
export interface SystemActorContext {
  userId?: string;
  roles?: string[];
  serviceContext?: string; // e.g., 'message-worker', 'notification-processor'
}

/**
 * System User Token Utility
 *
 * Creates system user tokens with proper configuration for different auth providers.
 * Designed to be used by application services and infrastructure components.
 */
export class SystemUserTokenUtil {
  constructor(private readonly config: SystemUserConfig) {}

  /**
   * Create a system user token for internal operations
   *
   * @param tenant - The tenant context for the operation
   * @param actor - Optional actor context for the system operation
   * @returns Properly configured IUserToken for system operations
   */
  createSystemUserToken(
    tenant: string,
    actor?: SystemActorContext,
  ): IUserToken {
    const now = Math.floor(Date.now() / 1000);
    const ttlHours = this.getTtlHours();

    const baseToken: IUserToken = {
      sub: this.getSubject(actor),
      name: this.getUserName(actor),
      email: this.getUserEmail(),
      tenant: tenant,
      tenant_id: tenant,
      roles: this.getUserRoles(actor),
      iat: now,
      exp: now + ttlHours * 3600,
    };

    // Add provider-specific claims
    return this.addProviderSpecificClaims(baseToken);
  }

  /**
   * Create a system user token with specific correlation context
   */
  createCorrelatedSystemUserToken(
    tenant: string,
    correlationId: string,
    actor?: SystemActorContext,
  ): IUserToken {
    const token = this.createSystemUserToken(tenant, actor);

    // Add correlation context to token metadata
    return {
      ...token,
      // Note: IUserToken might need extension for correlation metadata
      // This could be added to a custom system token interface if needed
    };
  }

  /**
   * Validate if a token is a system token
   */
  isSystemToken(token: IUserToken): boolean {
    const systemRoles = ['system', 'service-account', 'internal-service'];
    return token.roles?.some((role) => systemRoles.includes(role)) ?? false;
  }

  private getSubject(actor?: SystemActorContext): string {
    if (actor?.userId) {
      return actor.userId;
    }

    switch (this.config.provider) {
      case 'keycloak':
        return this.config.keycloak?.clientId || 'system-service';
      case 'jwt':
        return 'system-service';
      case 'internal':
        return `${this.config.internal?.systemPrefix || 'sys'}-service`;
      default:
        return 'system';
    }
  }

  private getUserName(actor?: SystemActorContext): string {
    if (actor?.serviceContext) {
      return `System Service (${actor.serviceContext})`;
    }

    return this.config.defaultUser.name || 'System Service';
  }

  private getUserEmail(): string {
    switch (this.config.provider) {
      case 'keycloak': {
        const clientId = this.config.keycloak?.clientId || 'system';
        const realm = this.config.keycloak?.realm || 'default';
        return `${clientId}@${realm}.service`;
      }
      case 'jwt':
      case 'internal':
      default:
        return this.config.defaultUser.email || 'system@service.local';
    }
  }

  private getUserRoles(actor?: SystemActorContext): string[] {
    const roles = [...this.config.defaultUser.roles];

    // Add actor-specific roles
    if (actor?.roles) {
      roles.push(...actor.roles);
    }

    // Add provider-specific system roles
    switch (this.config.provider) {
      case 'keycloak':
        roles.push('service-account');
        if (this.config.keycloak?.serviceAccountRoles) {
          roles.push(...this.config.keycloak.serviceAccountRoles);
        }
        break;
      case 'jwt':
        roles.push('system-service');
        break;
      case 'internal':
        roles.push('internal-service');
        break;
    }

    // Remove duplicates and return
    return [...new Set(roles)];
  }

  private getTtlHours(): number {
    switch (this.config.provider) {
      case 'keycloak':
      case 'jwt':
        return this.config.jwt?.defaultTtlHours || 1;
      case 'internal':
        return this.config.internal?.defaultTtlHours || 1;
      default:
        return 1;
    }
  }

  private addProviderSpecificClaims(token: IUserToken): IUserToken {
    // For future extension - add provider-specific JWT claims
    // This could include Keycloak realm info, custom scopes, etc.
    return token;
  }
}

/**
 * Factory function to create a SystemUserTokenUtil with default configuration
 */
export function createSystemUserTokenUtil(
  config?: Partial<SystemUserConfig>,
): SystemUserTokenUtil {
  const defaultConfig: SystemUserConfig = {
    provider: 'internal',
    defaultUser: {
      name: 'System Service',
      email: 'system@service.local',
      roles: ['system'],
    },
    internal: {
      systemPrefix: 'sys',
      defaultTtlHours: 1,
    },
  };

  const mergedConfig: SystemUserConfig = {
    ...defaultConfig,
    ...config,
    defaultUser: {
      ...defaultConfig.defaultUser,
      ...config?.defaultUser,
    },
    internal: {
      systemPrefix:
        config?.internal?.systemPrefix ?? defaultConfig.internal!.systemPrefix,
      defaultTtlHours:
        config?.internal?.defaultTtlHours ??
        defaultConfig.internal!.defaultTtlHours,
    },
    keycloak: config?.keycloak
      ? {
          ...config.keycloak,
        }
      : undefined,
    jwt: config?.jwt
      ? {
          ...config.jwt,
        }
      : undefined,
  };

  return new SystemUserTokenUtil(mergedConfig);
}

/**
 * Helper function for quick system token creation (backward compatibility)
 */
export function createSystemUserToken(
  tenant: string,
  actor?: { userId?: string; roles?: string[] },
): IUserToken {
  const util = createSystemUserTokenUtil();
  return util.createSystemUserToken(tenant, actor);
}
