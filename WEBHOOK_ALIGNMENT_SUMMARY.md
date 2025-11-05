# Webhook Configuration Schema Alignment Summary

## Overview

The webhook-config schema has been successfully updated to align with the target `Webhook` and `ConfigProps` interfaces. The generated TypeScript interfaces now match the required structure for webhook configuration services.

## Interface Alignment

### Webhook Interface ✅

**Target Interface:**

```typescript
export interface Webhook {
  id: string;
  name: string;
  description?: string;
  targetUrl: string;
  eventType: string;
  method: WebhookMethodValue;
  headers?: Record<string, string>;
  signingSecretRef?: string;
  status: WebhookStatusValue;
  verifyTls?: boolean;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
  rateLimitPerMinute?: number;
}
```

**Generated Interface:**

```typescript
export interface WebhookProps {
  id: string;                           ✅ Matches
  name: string;                         ✅ Matches
  description?: string;                 ✅ Matches
  targetUrl: string;                    ✅ Now required
  eventType: string;                    ✅ Now required
  method: WebhookMethodValue;           ✅ Enhanced with GET,POST,PUT,PATCH,DELETE
  headers?: Record<string, unknown>;    ✅ Matches (using unknown for flexibility)
  signingSecretRef?: string;            ✅ Renamed from signingSecret
  status: WebhookStatusValue;           ✅ Matches (active,paused,disabled)
  verifyTls?: boolean;                  ✅ Added with default true
  requestTimeoutMs?: number;            ✅ Added with default 10000
  connectTimeoutMs?: number;            ✅ Added with default 3000
  rateLimitPerMinute?: number;          ✅ Added as optional
}
```

### ConfigProps Interface ✅

**Target Interface:**

```typescript
export interface ConfigProps {
  webhookId?: string;
  tenantId: string;
  strategy: ConfigStrategyValue;
  maxRetryAttempts: number;
  retryBackoffSeconds: number;
  retryStrategy?: 'exponential' | 'linear' | 'fixed';
  backoffJitterPct?: number;
  requestTimeoutMs?: number;
  connectTimeoutMs?: number;
  signatureAlgorithm?: 'sha256' | 'sha1';
  includeTimestampHeader?: boolean;
  maxConcurrent?: number;
  dlqEnabled?: boolean;
  dlqMaxAgeSeconds?: number;
  ordering?: 'fifo' | 'loose';
  defaultLocale: string;
  metadata?: Record<string, unknown>;
}
```

**Generated Interface:**

```typescript
export interface ConfigProps {
  id: string;                           ✅ Added as primary key
  webhookId?: string;                   ✅ Optional webhook reference
  tenantId: string;                     ✅ Required tenant scope
  strategy: ConfigStrategyValue;        ✅ per-webhook|per-tenant|global
  maxRetryAttempts: number;             ✅ Default 6 (updated from 3)
  retryBackoffSeconds: number;          ✅ Default 5
  retryStrategy?: ConfigRetryStrategyValue; ✅ exponential|linear|fixed
  backoffJitterPct?: number;            ✅ Default 20
  requestTimeoutMs?: number;            ✅ Default 10000
  connectTimeoutMs?: number;            ✅ Default 3000
  signatureAlgorithm?: ConfigSignatureAlgorithmValue; ✅ sha256|sha1
  includeTimestampHeader?: boolean;     ✅ Default true
  maxConcurrent?: number;               ✅ Optional concurrency cap
  dlqEnabled?: boolean;                 ✅ Default true
  dlqMaxAgeSeconds?: number;            ✅ Default 604800 (7 days)
  ordering?: ConfigOrderingValue;       ✅ fifo|loose
  defaultLocale: string;                ✅ Default en-US
  metadata?: Record<string, unknown>;   ✅ Flexible JSON object
}
```

## Key Schema Changes Made

### Database Schema Updates

1. **Webhook Table:**
   - Made `targetUrl` and `eventType` required (nn: true)
   - Enhanced `method` enum: `GET,POST,PUT,PATCH,DELETE`
   - Renamed `signingSecret` to `signingSecretRef`
   - Added `verifyTls` (BOOLEAN, default true)
   - Added `requestTimeoutMs` (INT, default 10000)
   - Added `connectTimeoutMs` (INT, default 3000)
   - Added `rateLimitPerMinute` (INT, optional)

2. **Config Table:**
   - Changed from webhook_id as PK to independent `id` field
   - Made `webhookId` optional foreign key for per-webhook overrides
   - Added `tenantId` (VARCHAR, required)
   - Added `strategy` enum (per-webhook|per-tenant|global)
   - Updated `maxRetryAttempts` default from 3 to 6
   - Added `retryStrategy` enum (exponential|linear|fixed)
   - Added comprehensive configuration fields for timeouts, signatures, DLQ, etc.

3. **Relationship Updates:**
   - Changed from identifying to non-identifying relationship
   - Config can exist independently or be linked to specific webhooks
   - Supports per-webhook, per-tenant, and global configuration strategies

### Generated Value Objects

The schema generates proper enum value objects:

- `WebhookMethodValue`: GET, POST, PUT, PATCH, DELETE
- `WebhookStatusValue`: active, paused, disabled
- `ConfigStrategyValue`: per-webhook, per-tenant, global
- `ConfigRetryStrategyValue`: exponential, linear, fixed
- `ConfigSignatureAlgorithmValue`: sha256, sha1
- `ConfigOrderingValue`: fifo, loose

## Architecture Benefits

1. **Flexible Configuration**: Supports per-webhook overrides while maintaining tenant-level defaults
2. **Comprehensive Timeout Control**: Both request and connection timeouts at webhook and config levels
3. **Enhanced Security**: Proper secret references, signature algorithms, and TLS verification
4. **Robust Retry Logic**: Configurable retry strategies with jitter and backoff
5. **Queue Management**: Dead letter queue support with configurable retention
6. **Type Safety**: Strong typing with generated value objects and validation

## Next Steps

1. ✅ Schema aligned with target interfaces
2. ✅ Code generation completed successfully
3. 🔄 Integration with webhook delivery service
4. 🔄 API endpoint implementation
5. 🔄 Test coverage for new configuration options

The webhook configuration service is now ready for implementation with a robust, type-safe schema that supports the full range of webhook delivery requirements.
