import { ApiProperty } from '@nestjs/swagger';
export class HealthDetailMemoryResource {
  @ApiProperty({
    description:
      'The amount of memory (in megabytes) currently used on the heap.',
  })
  heapUsed: string;

  @ApiProperty({
    description: 'The total size of the allocated heap (in megabytes).',
  })
  heapTotal: string;

  @ApiProperty({
    description:
      'Memory allocated for ArrayBuffer and SharedArrayBuffer (in megabytes).',
  })
  arrayBuffers: string;

  @ApiProperty({
    description:
      'Resident Set Size: total memory allocated for the process (in megabytes).',
  })
  rss: string;
}

export class HealthDetailDatabaseResource {
  @ApiProperty({ description: 'Database connectivity status' })
  healthy: boolean;

  @ApiProperty({ description: 'Database schema name', required: false })
  schema?: string;

  @ApiProperty({ description: 'Database connection status' })
  isConnected: boolean;

  @ApiProperty({ description: 'Last health check timestamp' })
  lastCheck: string;

  @ApiProperty({ description: 'Migration status information' })
  migrations: {
    migrationsTableExists: boolean;
    lastCheck: string;
  };
}

export class HealthDetailServiceResource {
  @ApiProperty({ description: 'Service name' })
  name: string;

  @ApiProperty({ description: 'Service health status' })
  status: 'healthy' | 'unhealthy' | 'unknown';

  @ApiProperty({
    description: 'Response time in milliseconds',
    required: false,
  })
  responseTime?: number;

  @ApiProperty({ description: 'Last check timestamp' })
  lastCheck: string;

  @ApiProperty({ description: 'Service-specific details', required: false })
  details?: Record<string, any>;

  @ApiProperty({ description: 'Error message if unhealthy', required: false })
  error?: string;
}

export class HealthDetailSystemResource {
  @ApiProperty({ description: 'Application uptime in milliseconds' })
  uptime: number;

  @ApiProperty({ description: 'Node.js version' })
  nodeVersion: string;

  @ApiProperty({ description: 'Application version' })
  appVersion: string;

  @ApiProperty({ description: 'Environment' })
  environment: string;

  @ApiProperty({ description: 'Process ID' })
  pid: number;

  @ApiProperty({ description: 'Platform information' })
  platform: string;

  @ApiProperty({ description: 'CPU architecture' })
  arch: string;
}

export class HealthDetailResource {
  @ApiProperty({
    type: () => HealthDetailMemoryResource,
    description: 'Detailed memory usage statistics of the process.',
  })
  memory: HealthDetailMemoryResource;

  @ApiProperty({
    type: () => HealthDetailDatabaseResource,
    description: 'Detailed database health information.',
    required: false,
  })
  database?: HealthDetailDatabaseResource;

  @ApiProperty({
    type: () => HealthDetailSystemResource,
    description: 'System and runtime information.',
  })
  system: HealthDetailSystemResource;

  @ApiProperty({
    type: () => [HealthDetailServiceResource],
    description: 'Detailed health information for all external services.',
  })
  services: HealthDetailServiceResource[];
}

// ========== Repository Health DTOs ==========

export class RepositoryHealthSummaryResource {
  @ApiProperty({ description: 'Repository health status' })
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

  @ApiProperty({ description: 'Total operations performed' })
  totalOperations: number;

  @ApiProperty({ description: 'Average success rate (0-1)' })
  averageSuccessRate: number;

  @ApiProperty({ description: 'Average response time in milliseconds' })
  averageResponseTime: number;

  @ApiProperty({ description: 'Recent error count' })
  recentErrors: number;
}

export class RepositoryOperationMetricsResource {
  @ApiProperty({ description: 'Operation name' })
  operation: string;

  @ApiProperty({ description: 'Total count of operations' })
  count: number;

  @ApiProperty({ description: 'Average duration in milliseconds' })
  avgDuration: number;

  @ApiProperty({ description: 'Minimum duration in milliseconds' })
  minDuration: number;

  @ApiProperty({ description: 'Maximum duration in milliseconds' })
  maxDuration: number;

  @ApiProperty({ description: 'Success rate (0-1)' })
  successRate: number;

  @ApiProperty({ description: 'Error rate (0-1)' })
  errorRate: number;

  @ApiProperty({ description: 'Last update timestamp' })
  lastUpdate: string;
}

export class CacheInfoResource {
  @ApiProperty({ description: 'Cache status' })
  status: string;

  @ApiProperty({ description: 'Cache type', required: false })
  type?: string;

  @ApiProperty({ description: 'Cache size', required: false })
  size?: number;

  @ApiProperty({ description: 'Cache hit rate', required: false })
  hitRate?: number;

  @ApiProperty({ description: 'Memory usage in bytes', required: false })
  memoryUsage?: number;

  @ApiProperty({ description: 'Error message if applicable', required: false })
  error?: string;
}

export class RepositoryHealthResponse {
  @ApiProperty({ description: 'Repository health status' })
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown' | 'not_configured';

  @ApiProperty({ description: 'Health check timestamp' })
  timestamp: string;

  @ApiProperty({
    type: () => RepositoryHealthSummaryResource,
    description: 'Health summary',
    required: false,
  })
  summary?: RepositoryHealthSummaryResource;

  @ApiProperty({
    type: () => [RepositoryOperationMetricsResource],
    description: 'Top operations metrics',
    required: false,
  })
  operations?: RepositoryOperationMetricsResource[];

  @ApiProperty({
    type: () => CacheInfoResource,
    description: 'Cache information',
    required: false,
  })
  cache?: CacheInfoResource;

  @ApiProperty({ description: 'Message when not configured', required: false })
  message?: string;
}
