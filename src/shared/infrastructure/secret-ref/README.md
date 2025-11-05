# SecretRef Adapter - Implementation Guide

This directory contains a production-ready implementation of the SecretRef adapter for NestJS applications, specifically designed for Doppler integration with DDD/CQRS patterns.

## 🚀 Quick Start

### 1. Installation

The SecretRef adapter is already implemented in this directory. To use it in your application:

```typescript
import {
  SecretRefModule,
  SecretRefService,
} from './shared/infrastructure/secret-ref';

// Import the module in your app.module.ts
@Module({
  imports: [
    SecretRefModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### 2. Environment Configuration

Set the required environment variables:

```bash
# Required
DOPPLER_TOKEN=dp.st.your-service-token
DOPPLER_PROJECT=your-project-name
DOPPLER_CONFIG=dev

# Optional
DOPPLER_BASE_URL=https://api.doppler.com
DOPPLER_TIMEOUT_MS=5000
```

### 3. Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import {
  SecretRefService,
  createSecretRef,
} from './shared/infrastructure/secret-ref';

@Injectable()
export class MyService {
  constructor(private readonly secrets: SecretRefService) {}

  async useSecret() {
    const secretRef = createSecretRef(
      'doppler',
      'core', // tenant
      'notification', // namespace
      'api-key', // key
      'latest', // version
    );

    const { value } = await this.secrets.resolve(secretRef);
    // Use the secret value (never log it!)
  }
}
```

## 📁 Directory Structure

```
secret-ref/
├── secret-ref.module.ts          # Main NestJS module
├── secret-ref.service.ts         # Core service facade
├── secret-ref.types.ts           # Type definitions
├── index.ts                      # Public API exports
├── cache/
│   ├── cache.layer.ts           # Cache abstraction
│   ├── inmem.cache.ts           # In-memory cache
│   └── redis.cache.ts           # Redis cache (optional)
├── config/
│   └── secret-ref-config.validator.ts  # Config validation
├── health/
│   └── secret-ref-health.indicator.ts  # Health checks
├── metrics/
│   └── secret-ref-metrics.service.ts   # Prometheus metrics
├── policy/
│   └── policy.guard.ts          # Security policies
├── providers/
│   ├── doppler.client.ts        # Doppler HTTP client
│   ├── doppler.provider.ts      # Doppler integration
│   └── provider.registry.ts     # Provider registry
├── utils/
│   ├── key.util.ts             # Cache key utilities
│   └── mask.util.ts            # Secret masking
├── examples/
│   └── slack-example.ts        # Usage examples
└── __tests__/
    └── secret-ref.service.spec.ts  # Test suite
```

## 🔧 Key Features

### ✅ Security First

- **Zero plaintext exposure** in logs, events, or snapshots
- **Tenant isolation** with policy enforcement
- **Rate limiting** per tenant/namespace
- **Circuit breaker** for provider failures

### ✅ Performance & Reliability

- **In-memory caching** with TTL and jitter
- **Optional Redis caching** for distributed scenarios
- **Promise deduplication** to prevent thundering herd
- **Graceful degradation** with fallback options

### ✅ Production Ready

- **Configuration validation** at startup
- **Health check integration** with canary testing
- **Structured logging** with masked secrets
- **Prometheus metrics** (interfaces provided)
- **Comprehensive error handling** with typed errors

## 🏥 Health Monitoring

Add to your health controller:

```typescript
import { SecretRefHealthIndicator } from './shared/infrastructure/secret-ref';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private secretRefHealth: SecretRefHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.secretRefHealth.isHealthy('secret-ref'),
    ]);
  }
}
```

## 📊 Metrics Integration

```typescript
import { SecretRefMetricsService } from './shared/infrastructure/secret-ref';

// Initialize with prom-client instances
const metrics = new SecretRefMetricsService();
metrics.initializeMetrics({
  resolveCounter: new Counter({
    name: 'secret_adapter_resolve_total',
    help: 'Total secret resolution attempts',
    labelNames: ['provider', 'tenant', 'namespace', 'result', 'from_cache'],
  }),
  // ... other metrics
});
```

## 🔒 Secret Organization in Doppler

Organize your secrets using the path convention:

```
<tenant>/<namespace>/<key>

Examples:
core/notification/slack/bot-token
core/notification/slack/signing-secret
core/payment/stripe/api-key
tenant-123/notification/sendgrid/api-key
```

## 🧪 Testing

Run the test suite:

```bash
npm test secret-ref
```

Key testing scenarios covered:

- Cache hit/miss behavior
- Policy enforcement (tenant isolation, rate limits)
- Circuit breaker functionality
- Promise deduplication
- Secret value masking in logs
- Health check reliability

## 🚨 Important Security Notes

1. **Never log secret values** - All logging is structured and value-free
2. **Use SecretRef in domain/application layers** - Only resolve in infrastructure
3. **Implement proper tenant isolation** - Configure policy guards appropriately
4. **Use pinned versions in production** - Set `requireVersion: true` for prod
5. **Monitor rate limits** - Set appropriate `rateLimitConfig` for your usage

## 🔄 Rotation Strategy

- **Development**: Use `version: 'latest'` for automatic rotation
- **Production**: Use pinned versions (e.g., `version: '42'`) and update refs during deployment
- **Cache warming**: Call `hydrate([ref])` after rotation to pre-warm caches

## 🛠️ Customization

### Using Redis Cache

```typescript
// In your module
{
  provide: CacheLayer,
  useFactory: (redis: Redis) => new RedisCache(redis),
  inject: [REDIS_CLIENT],
}
```

### Custom Policy Rules

Extend `PolicyGuard` to add your own security rules:

```typescript
@Injectable()
export class CustomPolicyGuard extends PolicyGuard {
  ensureAllowed(
    ref: SecretRef,
    opts: ResolveOptions,
    ctx?: SecretResolutionContext,
  ) {
    super.ensureAllowed(ref, opts, ctx);

    // Add your custom rules here
    if (ref.key.includes('production') && ctx?.environment !== 'prod') {
      throw new SecretRefError(
        'Production secrets not allowed in dev',
        'POLICY_DENIED',
        ref,
      );
    }
  }
}
```

## 📚 Additional Resources

See the `/examples` directory for complete usage examples including:

- Slack API integration
- Database connection strings
- JWT signing keys
- External service credentials

## 🤝 Contributing

When adding new features:

1. Update type definitions in `secret-ref.types.ts`
2. Add comprehensive tests in `__tests__/`
3. Update this README
4. Ensure no secret values are logged anywhere
5. Follow the existing error handling patterns

---

**Remember**: This implementation prioritizes security and reliability. Always verify that secret values never appear in logs, events, or error messages. 🔐
