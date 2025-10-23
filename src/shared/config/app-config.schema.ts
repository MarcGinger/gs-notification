/**
 * Base Configuration Schema
 *
 * Defines the foundational configuration schema using Zod validation.
 * This schema supports both traditional process.env and Doppler secret management.
 */

// Environment enumeration
import { z } from 'zod';

// Single clean AppConfig schema implementation
export const Environment = z.enum([
  'development',
  'staging',
  'production',
  'test',
]);
export type Environment = z.infer<typeof Environment>;

export const LogLevel = z.enum([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
  'silent',
]);
export type LogLevel = z.infer<typeof LogLevel>;

export const LogSink = z.enum(['stdout', 'console', 'loki', 'elasticsearch']);
export type LogSink = z.infer<typeof LogSink>;

export const CoreConfigSchema = z.object({
  APP_CORE_NAME: z.string().min(1).default('gs-scaffold'),
  APP_CORE_VERSION: z.string().min(1).default('0.0.1'),
  APP_RUNTIME_ENVIRONMENT: Environment.default('development'),
  APP_SERVER_PORT: z.coerce.number().int().min(1000).max(65535).default(3000),
  APP_SERVER_PROTOCOL: z.enum(['http', 'https']).default('http'),
  APP_SERVER_HOST: z.string().min(1).default('localhost'),
  APP_SERVER_PUBLIC_URL: z.string().url().optional(),
  APP_SERVER_STAGING_URL: z.string().url().optional(),
});

export const DatabaseConfigSchema = z.object({
  DATABASE_POSTGRES_URL: z.string().url().optional(),
  DATABASE_POSTGRES_HOST: z.string().min(1).default('localhost'),
  DATABASE_POSTGRES_PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(5432),
  DATABASE_POSTGRES_NAME: z.string().min(1).default('postgres'),
  DATABASE_POSTGRES_USER: z.string().min(1).default('postgres'),
  DATABASE_POSTGRES_PASSWORD: z.string().min(1),
  DATABASE_POSTGRES_SSL_ENABLED: z.coerce.boolean().default(false),
  DATABASE_POSTGRES_SSL_REJECT_UNAUTHORIZED: z.coerce.boolean().default(true),
  DATABASE_POSTGRES_POOL_MIN: z.coerce.number().int().min(0).default(0),
  DATABASE_POSTGRES_POOL_MAX: z.coerce.number().int().min(1).default(10),
});

export const CacheConfigSchema = z.object({
  CACHE_REDIS_URL: z.string().url(),
  CACHE_REDIS_PASSWORD: z.string().optional(),
});

export const EventStoreConfigSchema = z.object({
  EVENTSTORE_ESDB_CONNECTION_STRING: z.string().url(),
});

export const AuthConfigSchema = z.object({
  AUTH_KEYCLOAK_URL: z.string().url().default('http://localhost:8080'),
  AUTH_KEYCLOAK_REALM: z.string().min(1).default('gs-scaffold'),
  AUTH_KEYCLOAK_CLIENT_ID: z.string().min(1).default('gs-scaffold-api'),
  AUTH_KEYCLOAK_CLIENT_SECRET: z.string().min(8),
  AUTH_JWT_AUDIENCE: z.string().min(1).default('gs-scaffold-api'),
  AUTH_JWKS_CACHE_MAX_AGE: z.coerce.number().int().min(60000).default(3600000),
  AUTH_JWKS_REQUESTS_PER_MINUTE: z.coerce
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(10),
  AUTH_JWKS_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
});

export const SecurityConfigSchema = z.object({
  SECURITY_PII_ENCRYPTION_KEY: z.string().min(32),
  SECURITY_OPA_URL: z.string().url().default('http://localhost:8181'),
  SECURITY_OPA_TIMEOUT_MS: z.coerce.number().int().min(1000).default(5000),
  SECURITY_OPA_DECISION_LOGS_ENABLED: z.coerce.boolean().default(true),
  SECURITY_OPA_CIRCUIT_BREAKER_FAILURE_THRESHOLD: z.coerce
    .number()
    .int()
    .min(1)
    .default(5),
  SECURITY_OPA_CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .default(60000),
  SECURITY_OPA_CIRCUIT_BREAKER_SUCCESS_THRESHOLD: z.coerce
    .number()
    .int()
    .min(1)
    .default(3),
  SECURITY_CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  SECURITY_CORS_ALLOW_CREDENTIALS: z.coerce.boolean().default(true),
});

export const LoggingConfigSchema = z.object({
  LOGGING_CORE_LEVEL: LogLevel.default('info'),
  LOGGING_CORE_SINK: LogSink.default('stdout'),
  LOGGING_CORE_PRETTY_ENABLED: z.coerce.boolean().default(false),
  LOGGING_CORE_REDACT_KEYS: z.string().optional(),
  LOGGING_LOKI_URL: z.string().url().optional(),
  LOGGING_LOKI_BASIC_AUTH: z.string().optional(),
  LOGGING_ELASTICSEARCH_NODE: z.string().url().optional(),
  LOGGING_ELASTICSEARCH_INDEX: z.string().min(1).default('app-logs'),
});

export const InfrastructureConfigSchema = z.object({
  INFRA_CONTAINER_DOCKER_ENABLED: z.coerce.boolean().optional(),
  INFRA_CONTAINER_HOST: z.string().optional(),
  INFRA_SYSTEM_HOSTNAME: z.string().optional(),
  INFRA_KUBERNETES_SERVICE_HOST: z.string().optional(),
});

export const AppConfigSchema = CoreConfigSchema.merge(DatabaseConfigSchema)
  .merge(CacheConfigSchema)
  .merge(EventStoreConfigSchema)
  .merge(AuthConfigSchema)
  .merge(SecurityConfigSchema)
  .merge(LoggingConfigSchema)
  .merge(InfrastructureConfigSchema);

export type AppConfig = z.infer<typeof AppConfigSchema>;

export const EnvironmentValidationRules = {
  development: {
    requiredSecrets: [
      'SECURITY_PII_ENCRYPTION_KEY',
      'DATABASE_POSTGRES_PASSWORD',
    ],
    optionalSecrets: ['AUTH_KEYCLOAK_CLIENT_SECRET'],
  },
  staging: {
    requiredSecrets: [
      'SECURITY_PII_ENCRYPTION_KEY',
      'DATABASE_POSTGRES_PASSWORD',
      'AUTH_KEYCLOAK_CLIENT_SECRET',
      'CACHE_REDIS_URL',
      'EVENTSTORE_ESDB_CONNECTION_STRING',
    ],
  },
  production: {
    requiredSecrets: [
      'SECURITY_PII_ENCRYPTION_KEY',
      'DATABASE_POSTGRES_PASSWORD',
      'AUTH_KEYCLOAK_CLIENT_SECRET',
      'CACHE_REDIS_URL',
      'EVENTSTORE_ESDB_CONNECTION_STRING',
    ],
    securityRules: {
      httpsRequired: true,
      fallbacksDisallowed: true,
      prettyLogsDisallowed: true,
    },
  },
  test: {
    requiredSecrets: ['SECURITY_PII_ENCRYPTION_KEY'],
  },
};

export function validateEnvironmentConfig(
  config: AppConfig,
  environment: Environment,
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rules = EnvironmentValidationRules[environment];

  if (rules?.requiredSecrets && Array.isArray(rules.requiredSecrets)) {
    const maybe = config as unknown as Record<string, unknown>;
    for (const secret of rules.requiredSecrets) {
      const value = maybe[secret];
      if (value === undefined || value === null) {
        errors.push(
          `Required secret ${secret} is missing for ${environment} environment`,
        );
        continue;
      }
      if (typeof value === 'string' && value.trim() === '') {
        errors.push(
          `Required secret ${secret} is missing for ${environment} environment`,
        );
      }
    }
  }

  if (environment === 'production') {
    const productionRules = EnvironmentValidationRules.production;
    if (productionRules?.securityRules?.httpsRequired) {
      if (
        typeof config.AUTH_KEYCLOAK_URL === 'string' &&
        config.AUTH_KEYCLOAK_URL.startsWith('http://')
      ) {
        errors.push('HTTPS required for AUTH_KEYCLOAK_URL in production');
      }
      if (config.APP_SERVER_PROTOCOL === 'http') {
        warnings.push(
          'Consider using HTTPS for APP_SERVER_PROTOCOL in production',
        );
      }
    }

    if (
      productionRules?.securityRules?.prettyLogsDisallowed &&
      config.LOGGING_CORE_PRETTY_ENABLED
    ) {
      errors.push(
        'LOGGING_CORE_PRETTY_ENABLED must be false in production for performance',
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
