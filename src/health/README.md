# Health Check System

This directory contains a production-grade health check system for the NestJS application.

## Endpoints

- `GET /actuator` - Overall health check (backward compatible)
- `GET /actuator/live` - Liveness probe (Kubernetes-friendly)
- `GET /actuator/ready` - Readiness probe (Kubernetes-friendly)
- `GET /actuator/detail` - Detailed health diagnostics
- `GET /actuator/info` - Application metadata

## Health Indicators

### Memory Indicators

- Heap memory usage
- RSS memory usage

### External Dependencies

- **PostgreSQL** - Database connectivity check
- **Redis** - Cache connectivity check
- **EventStoreDB** - Event store connectivity check
- **OPA** - Policy engine connectivity check

## Configuration

Set these environment variables:

```env
# Database
DATABASE_URL=postgres://user:pass@localhost:5432/dbname

# Redis
REDIS_URL=redis://localhost:6379

# EventStore
ESDB_ENDPOINT=esdb://localhost:2113?tls=false

# OPA Policy Engine
OPA_BASE_URL=http://localhost:8181

# Application metadata (optional)
APP_NAME=gs-scaffold
APP_VERSION=0.0.0
GIT_SHA=unknown
BOOT_TIME=<timestamp>
```

## Kubernetes Configuration

```yaml
livenessProbe:
  httpGet:
    path: /actuator/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /actuator/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
```

## Implementation Details

- **Timeouts**: All external checks use 1-1.5s timeouts to prevent hung probes
- **Timeout Safety**: Uses `withTimeout` helper that always clears timers in finally blocks
- **Liveness**: Only checks in-process memory, no external dependencies
- **Readiness**: Checks all external dependencies required for serving traffic
- **Error Handling**: Proper Result pattern with structured error responses
- **Security**: Consider protecting `/actuator/detail` with authentication

## Files Structure

```
src/health/
├── indicators/           # Individual health indicators
│   ├── esdb.health.indicator.ts
│   ├── redis.health.indicator.ts
│   ├── postgres.health.indicator.ts
│   └── opa.health.indicator.ts
├── health.controller.ts  # HTTP endpoints
├── health.module.ts      # DI configuration
├── health.dto.ts         # Response types
├── timeout.helper.ts     # Timeout utilities
└── index.ts             # Public exports
```
