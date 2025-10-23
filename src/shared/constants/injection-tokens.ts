/**
 * Centralized Injection Tokens and Configuration Keys
 *
 * This file contains all dependency injection tokens and configuration keys used throughout the application.
 * Using constants instead of magic strings provides:
 * - Type safety and compile-time validation
 * - Easier refactoring and maintenance
 * - IDE support for find/replace operations
 * - Prevention of typos in injection token names
 */

// Core Application Tokens
export const INJECTION_TOKENS = {
  // Logging
  APP_LOGGER: 'APP_LOGGER',

  // Data Sources
  DATA_SOURCE: 'DATA_SOURCE',
  ESDB_CLIENT: 'ESDB_CLIENT',
  EVENT_STORE_CLIENT: 'EVENT_STORE_CLIENT',
  EVENTSTORE_DB_CLIENT: 'EventStoreDBClient',
  EVENTSTORE_CLIENT: 'EVENTSTORE_CLIENT',

  // Redis
  REDIS: 'REDIS',
  BULLMQ_REDIS_CLIENT: 'BullMQ_Redis_Client',
  IO_REDIS: 'IORedis',
  REDIS_CLUSTER: 'IORedisCluster',

  // Queues
  NOTIFICATION_QUEUE: 'NotificationQueue',
  PROJECTION_QUEUE: 'ProjectionQueue',

  // Services
  CACHE_SERVICE: 'CACHE_SERVICE',

  // Infrastructure
  CHECKPOINT_STORE: 'CHECKPOINT_STORE',
  OUTBOX_REPOSITORY: 'OUTBOX_REPOSITORY',
  CATCHUP_RUNNER: 'CATCHUP_RUNNER',

  // Configuration
  AUDIT_CONFIG: 'AUDIT_CONFIG',
  BULLMQ_MODULE_OPTIONS: 'BULLMQ_MODULE_OPTIONS',
  BULLMQ_CONNECTION_OPTIONS: 'BullMQ_Connection_Options',
  DOPPLER_CONFIG: 'DOPPLER_CONFIG',

  // External Services
  OPA_BASE_URL: 'OPA_BASE_URL',
  KAFKA_PRODUCER: 'KAFKA_PRODUCER',
  KAFKA_CONSUMER: 'KAFKA_CONSUMER',

  // Infrastructure
  CLOCK: 'CLOCK',
  ID_GENERATOR: 'ID_GENERATOR',
  TENANT_CONTEXT: 'TENANT_CONTEXT',
} as const;

// Configuration Keys Constants
export const CONFIG_KEYS = {
  // EventStore
  EVENTSTORE_ESDB_CONNECTION_STRING: 'EVENTSTORE_ESDB_CONNECTION_STRING',
  ESDB_CONNECTION_STRING: 'ESDB_CONNECTION_STRING',
  ESDB_ENDPOINT: 'ESDB_ENDPOINT',

  // Redis/Cache
  CACHE_REDIS_URL: 'CACHE_REDIS_URL',

  // External Services
  OPA_BASE_URL: 'OPA_BASE_URL',

  // Infrastructure
  REDIS_URL: 'REDIS_URL',
} as const;

// Type for injection token values
export type InjectionToken =
  (typeof INJECTION_TOKENS)[keyof typeof INJECTION_TOKENS];

// Type for configuration key values
export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

// Individual exports for convenience - Injection Tokens
export const {
  APP_LOGGER,
  DATA_SOURCE,
  ESDB_CLIENT,
  EVENT_STORE_CLIENT,
  EVENTSTORE_DB_CLIENT,
  EVENTSTORE_CLIENT,
  REDIS,
  BULLMQ_REDIS_CLIENT,
  IO_REDIS,
  REDIS_CLUSTER,
  NOTIFICATION_QUEUE,
  PROJECTION_QUEUE,
  CACHE_SERVICE,
  CHECKPOINT_STORE,
  OUTBOX_REPOSITORY,
  CATCHUP_RUNNER,
  AUDIT_CONFIG,
  BULLMQ_MODULE_OPTIONS,
  BULLMQ_CONNECTION_OPTIONS,
  DOPPLER_CONFIG,
  OPA_BASE_URL,
  KAFKA_PRODUCER,
  KAFKA_CONSUMER,
  CLOCK,
  ID_GENERATOR,
  TENANT_CONTEXT,
} = INJECTION_TOKENS;

// Individual exports for convenience - Config Keys
export const {
  EVENTSTORE_ESDB_CONNECTION_STRING,
  ESDB_CONNECTION_STRING,
  ESDB_ENDPOINT,
  CACHE_REDIS_URL,
  REDIS_URL,
} = CONFIG_KEYS;

// Special exports to avoid naming conflicts
export const OPA_BASE_URL_CONFIG_KEY = CONFIG_KEYS.OPA_BASE_URL;
