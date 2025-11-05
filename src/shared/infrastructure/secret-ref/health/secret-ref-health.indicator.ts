import { Injectable } from '@nestjs/common';
import {
  HealthCheckError,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { SecretRefService } from '../secret-ref.service';

@Injectable()
export class SecretRefHealthIndicator extends HealthIndicator {
  constructor(private readonly secretRef: SecretRefService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const health = await this.secretRef.healthCheck();

    const result = this.getStatus(key, health.healthy, {
      latencyMs: health.latencyMs,
      provider: 'doppler',
    });

    if (!health.healthy) {
      throw new HealthCheckError('SecretRef health check failed', result);
    }

    return result;
  }
}
