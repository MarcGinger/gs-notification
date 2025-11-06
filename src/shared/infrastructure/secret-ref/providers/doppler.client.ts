import { SecretRefError } from '../secret-ref.types';

export interface DopplerClientOptions {
  token: string; // Service token – read from env/secret store
  project: string; // Doppler project slug
  config: string; // Doppler config (dev/staging/prod)
  baseUrl: string; // Doppler API base
  timeoutMs: number;
}

export class DopplerClient {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerTimeout = 30_000; // 30 seconds

  constructor(private readonly opts: DopplerClientOptions) {
    if (!this.opts.token) {
      throw new SecretRefError('DOPPLER_TOKEN is required', 'CONFIG_ERROR');
    }
  }

  async getSecret(
    path: string,
    version = 'latest',
  ): Promise<{
    value: string;
    version: string;
    expiresAt?: string;
    project: string;
    config: string;
  }> {
    // Circuit breaker check
    if (this.isCircuitOpen()) {
      throw new SecretRefError('Circuit breaker is open', 'PROVIDER_ERROR');
    }

    try {
      // Minimal HTTP; replace with official SDK if desired.
      const url = `${this.opts.baseUrl}/v3/configs/config/secret?project=${encodeURIComponent(this.opts.project)}&config=${encodeURIComponent(this.opts.config)}&name=${encodeURIComponent(path)}&version=${encodeURIComponent(version)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.opts.token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.opts.timeoutMs),
      });

      if (!res.ok) {
        this.recordFailure();
        throw new SecretRefError(
          `Doppler API error: ${res.status}`,
          'PROVIDER_ERROR',
        );
      }

      const data = (await res.json()) as any;
      this.recordSuccess();

      // Shape normalization - extract actual secret value from Doppler API response
      const secretValue = String(
        data?.value?.computed ?? data?.value?.raw ?? '',
      );
      return {
        value: secretValue,
        version: String(data?.version ?? 'latest'),
        expiresAt: data?.expires_at ? String(data.expires_at) : undefined,
        project: this.opts.project,
        config: this.opts.config,
      };
    } catch (error) {
      this.recordFailure();
      if (error instanceof SecretRefError) throw error;
      throw new SecretRefError(
        `Doppler client error: ${error.message}`,
        'PROVIDER_ERROR',
      );
    }
  }

  private isCircuitOpen(): boolean {
    if (this.failureCount < this.circuitBreakerThreshold) return false;
    return Date.now() - this.lastFailureTime < this.circuitBreakerTimeout;
  }

  private recordSuccess() {
    this.failureCount = 0;
  }

  private recordFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }
}
