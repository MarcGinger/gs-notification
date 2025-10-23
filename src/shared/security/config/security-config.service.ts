import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigManager } from '../../config/config.manager';
import { DomainError, Result, ok, err, withContext } from '../../errors';

interface SecurityConfig {
  keycloak: {
    url: string;
    realm: string;
    clientId: string;
    clientSecret?: string;
  };
  jwt: {
    audience: string;
    issuer: string;
    cacheMaxAge: number;
    requestsPerMinute: number;
    timeoutMs: number;
  };
  cors: {
    allowedOrigins: string[];
    allowCredentials: boolean;
  };
}

/**
 * Security Configuration Error Definitions
 * Defines all errors that can occur during security configuration operations
 */
const SecurityConfigErrorDefinitions = {
  CONFIGURATION_VALIDATION_FAILED: {
    title: 'Configuration Validation Failed',
    detail: 'Security configuration validation failed',
    category: 'validation' as const,
    retryable: false,
  },

  CONFIGURATION_ACCESS_FAILED: {
    title: 'Configuration Access Failed',
    detail: 'Failed to access security configuration',
    category: 'infrastructure' as const,
    retryable: true,
  },
} as const;

/**
 * Security configuration error catalog with namespaced error codes
 */
const SecurityConfigErrors = Object.fromEntries(
  Object.entries(SecurityConfigErrorDefinitions).map(([key, errorDef]) => {
    const code = `SECURITY_CONFIG.${key}` as const;
    return [key, { ...errorDef, code }];
  }),
) as {
  [K in keyof typeof SecurityConfigErrorDefinitions]: DomainError<`SECURITY_CONFIG.${Extract<K, string>}`>;
};

@Injectable()
export class SecurityConfigService {
  private readonly configManager: ConfigManager;

  constructor(private readonly configService: ConfigService) {
    this.configManager = ConfigManager.getInstance();
  }

  /**
   * Get validated security configuration safely (Result pattern)
   * @returns Result containing validated config or detailed error information
   */
  getValidatedConfigSafe(): Result<SecurityConfig, DomainError> {
    try {
      const validation = this.configManager.validateSecurityConfig();

      if (!validation.valid) {
        return err(
          withContext(SecurityConfigErrors.CONFIGURATION_VALIDATION_FAILED, {
            operation: 'SecurityConfigService.getValidatedConfig',
            validationErrors: validation.errors,
            validationWarnings: validation.warnings,
            errorCount: validation.errors.length,
            warningCount: validation.warnings.length,
          }),
        );
      }

      // Use ConfigManager as source of truth for validated config
      const config = this.configManager.getSecurityConfig();
      return ok(config);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return err(
        withContext(SecurityConfigErrors.CONFIGURATION_ACCESS_FAILED, {
          operation: 'SecurityConfigService.getValidatedConfig',
          reason: errorMessage,
          errorType: typeof error,
        }),
      );
    }
  }

  /**
   * Get JWT-specific configuration with validation (Result pattern)
   */
  getValidatedJwtConfigSafe(): Result<SecurityConfig['jwt'], DomainError> {
    const configResult = this.getValidatedConfigSafe();
    if (!configResult.ok) {
      return configResult;
    }
    return ok(configResult.value.jwt);
  }

  /**
   * Get Keycloak-specific configuration with validation (Result pattern)
   */
  getValidatedKeycloakConfigSafe(): Result<
    SecurityConfig['keycloak'],
    DomainError
  > {
    const configResult = this.getValidatedConfigSafe();
    if (!configResult.ok) {
      return configResult;
    }
    return ok(configResult.value.keycloak);
  }

  /**
   * Get CORS configuration with validation (Result pattern)
   */
  getValidatedCorsConfigSafe(): Result<SecurityConfig['cors'], DomainError> {
    const configResult = this.getValidatedConfigSafe();
    if (!configResult.ok) {
      return configResult;
    }
    return ok(configResult.value.cors);
  }

  /**
   * Validate configuration without throwing errors
   * Returns validation result for conditional logic
   */
  validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
    return this.configManager.validateSecurityConfig();
  }

  /**
   * Get JWKS URI for JWT verification (Result pattern)
   */
  getJwksUriSafe(): Result<string, DomainError> {
    const keycloakResult = this.getValidatedKeycloakConfigSafe();
    if (!keycloakResult.ok) {
      return keycloakResult;
    }

    const keycloakConfig = keycloakResult.value;
    const jwksUri = `${keycloakConfig.url}/realms/${keycloakConfig.realm}/protocol/openid-connect/certs`;
    return ok(jwksUri);
  }

  /**
   * Get issuer URL for JWT validation (Result pattern)
   */
  getIssuerUrlSafe(): Result<string, DomainError> {
    const keycloakResult = this.getValidatedKeycloakConfigSafe();
    if (!keycloakResult.ok) {
      return keycloakResult;
    }

    const keycloakConfig = keycloakResult.value;
    const issuerUrl = `${keycloakConfig.url}/realms/${keycloakConfig.realm}`;
    return ok(issuerUrl);
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.configManager.isProduction();
  }

  /**
   * Get configuration summary for debugging (Result pattern)
   */
  /**
   * Get configuration summary for debugging (Result pattern)
   */
  getConfigSummarySafe(): Result<
    {
      environment: string;
      keycloak: {
        url: string;
        realm: string;
        clientId: string;
        hasClientSecret: boolean;
      };
      jwt: {
        audience: string;
        issuer: string;
        cacheMaxAge: number;
        requestsPerMinute: number;
        timeoutMs: number;
      };
      cors: {
        allowedOrigins: string[];
        allowCredentials: boolean;
      };
    },
    DomainError
  > {
    const configResult = this.getValidatedConfigSafe();
    if (!configResult.ok) {
      return configResult;
    }

    const config = configResult.value;
    const summary = {
      environment: this.configManager.getEnvironment(),
      keycloak: {
        url: config.keycloak.url,
        realm: config.keycloak.realm,
        clientId: config.keycloak.clientId,
        hasClientSecret: !!config.keycloak.clientSecret,
      },
      jwt: {
        audience: config.jwt.audience,
        issuer: config.jwt.issuer,
        cacheMaxAge: config.jwt.cacheMaxAge,
        requestsPerMinute: config.jwt.requestsPerMinute,
        timeoutMs: config.jwt.timeoutMs,
      },
      cors: {
        allowedOrigins: config.cors.allowedOrigins,
        allowCredentials: config.cors.allowCredentials,
      },
    };

    return ok(summary);
  }
}
