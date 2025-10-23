import { DocumentBuilder } from '@nestjs/swagger';
import { AppConfigUtil } from 'src/shared/config/app-config.util';

// Swagger configuration constants
const SWAGGER_CONSTANTS = {
  DEFAULTS: {
    LOCAL_PROTOCOL: 'http',
  },
  DESCRIPTIONS: {
    LOCAL_DEVELOPMENT: 'Local development server',
    STAGING_KEYWORD: 'Staging',
  },
} as const;

/**
 * Swagger Configuration Utilities
 *
 * Specialized utilities for Swagger server configuration, extending base application configuration
 */
export class SwaggerConfigUtil {
  /**
   * Dynamically determine the server URL for Swagger documentation
   * with Swagger-specific environment variable overrides
   */
  static getServerUrl(port: string | number): string {
    // Use centralized protocol determination - no direct env access needed
    const protocol = AppConfigUtil.getProtocol();
    const host = AppConfigUtil.getHost();

    // For production environments with load balancers or reverse proxies
    if (AppConfigUtil.isProduction()) {
      // Priority: PUBLIC_API_URL > computed URL
      const publicUrl = AppConfigUtil.getPublicBaseUrl();
      return publicUrl?.toString() || `${protocol}://${host}:${port}`;
    }

    // For development and staging
    return `${protocol}://${host}:${port}`;
  }

  /**
   * Get multiple server configurations for Swagger documentation
   */
  static getServerConfigurations(
    port: string | number,
  ): Array<{ url: string; description: string }> {
    const servers: Array<{ url: string; description: string }> = [];

    // Always include the current environment server
    servers.push({
      url: SwaggerConfigUtil.getServerUrl(port),
      description: `${AppConfigUtil.getEnvironment()} server`,
    });

    // Add additional servers based on environment
    if (!AppConfigUtil.isProduction()) {
      // Development servers
      const localUrl = `${SWAGGER_CONSTANTS.DEFAULTS.LOCAL_PROTOCOL}://localhost:${port}`;
      if (SwaggerConfigUtil.getServerUrl(port) !== localUrl) {
        servers.push({
          url: localUrl,
          description: SWAGGER_CONSTANTS.DESCRIPTIONS.LOCAL_DEVELOPMENT,
        });
      }

      // Staging server (if configured)
      const stagingUrl = AppConfigUtil.getServerConfigurations(
        Number(port),
      ).find((server) =>
        server.description.includes(
          SWAGGER_CONSTANTS.DESCRIPTIONS.STAGING_KEYWORD,
        ),
      );
      if (stagingUrl) {
        servers.push(stagingUrl);
      }
    }

    return servers;
  }

  /**
   * Apply server configurations to DocumentBuilder
   */
  static addServers(
    builder: DocumentBuilder,
    port: string | number,
  ): DocumentBuilder {
    const servers = SwaggerConfigUtil.getServerConfigurations(port);

    servers.forEach((server) => {
      builder.addServer(server.url, server.description);
    });

    return builder;
  }
}
