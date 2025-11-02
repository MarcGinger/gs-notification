/**
 * System User Token Configuration Examples
 *
 * This file shows how to configure the SystemUserTokenUtil for different environments
 * and authentication providers.
 */

import {
  SystemUserConfig,
  SystemUserTokenUtil,
  createSystemUserTokenUtil,
} from './system-user-token.util';

/**
 * Development Configuration (Internal Auth)
 */
export const developmentSystemUserConfig: SystemUserConfig = {
  provider: 'internal',
  defaultUser: {
    name: 'Development System Service',
    email: 'system@dev.local',
    roles: ['system', 'dev-internal'],
  },
  internal: {
    systemPrefix: 'dev-sys',
    defaultTtlHours: 2, // Longer TTL for development
  },
};

/**
 * Production Configuration (Keycloak Service Account)
 */
export const productionKeycloakConfig: SystemUserConfig = {
  provider: 'keycloak',
  defaultUser: {
    name: 'Notification Service Account',
    email: 'notification-service@company.com',
    roles: ['system', 'notification-processor'],
  },
  keycloak: {
    clientId: 'notification-service',
    realm: 'company-realm',
    serviceAccountRoles: ['message-sender', 'queue-processor'],
  },
};

/**
 * Staging Configuration (JWT Service)
 */
export const stagingJwtConfig: SystemUserConfig = {
  provider: 'jwt',
  defaultUser: {
    name: 'Staging System Service',
    email: 'system@staging.company.com',
    roles: ['system', 'staging-service'],
  },
  jwt: {
    issuer: 'https://auth.staging.company.com',
    audience: 'notification-api',
    defaultTtlHours: 1,
  },
};

/**
 * Environment-based configuration factory
 */
export function createEnvironmentSystemUserUtil(): SystemUserTokenUtil {
  const environment = process.env.NODE_ENV || 'development';

  switch (environment) {
    case 'production':
      return createSystemUserTokenUtil(productionKeycloakConfig);
    case 'staging':
      return createSystemUserTokenUtil(stagingJwtConfig);
    case 'development':
    case 'test':
    default:
      return createSystemUserTokenUtil(developmentSystemUserConfig);
  }
}

/**
 * Usage Examples
 */
export class SystemUserExamples {
  private readonly systemUserUtil = createEnvironmentSystemUserUtil();

  /**
   * Example: Worker service creating system token
   */
  async processWorkerJob(tenantId: string, jobData: any) {
    const systemToken = this.systemUserUtil.createSystemUserToken(tenantId, {
      serviceContext: 'message-worker',
      roles: ['queue-processor'],
    });

    // Use systemToken for internal API calls...
  }

  /**
   * Example: Service with specific user context
   */
  async recordDeliveryOutcome(tenantId: string, userId: string) {
    const systemToken = this.systemUserUtil.createSystemUserToken(tenantId, {
      userId: userId, // Use actual user ID when available
      roles: ['delivery-recorder'],
      serviceContext: 'outcome-processor',
    });

    // Use systemToken for recording delivery...
  }

  /**
   * Example: Cross-service communication
   */
  async callExternalService(tenantId: string, correlationId: string) {
    const systemToken = this.systemUserUtil.createCorrelatedSystemUserToken(
      tenantId,
      correlationId,
      {
        serviceContext: 'external-api-client',
        roles: ['api-client'],
      },
    );

    // Use systemToken for external service calls...
  }
}
