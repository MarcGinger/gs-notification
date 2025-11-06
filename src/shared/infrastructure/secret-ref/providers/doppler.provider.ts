import { Injectable } from '@nestjs/common';
import { DopplerClient } from './doppler.client';
import {
  ResolvedSecret,
  ResolveOptions,
  SecretMetadata,
  SecretRef,
} from '../secret-ref.types';

@Injectable()
export class DopplerProvider {
  constructor(private readonly api: DopplerClient) {}

  async resolve(
    ref: SecretRef,
    _opts?: ResolveOptions,
  ): Promise<ResolvedSecret> {
    // Doppler uses flat key names, not hierarchical paths
    const secretName = ref.key;
    const version = ref.version ?? 'latest';
    const t0 = Date.now();
    const res = await this.api.getSecret(secretName, version);
    const latency = Date.now() - t0;
    return {
      value: res.value,
      version: res.version,
      expiresAt: res.expiresAt ? Date.parse(res.expiresAt) : undefined,
      providerLatencyMs: latency,
      providerMeta: { project: res.project, config: res.config },
    };
  }

  async inspect(ref: SecretRef): Promise<SecretMetadata> {
    // Doppler uses flat key names, not hierarchical paths
    const secretName = ref.key;
    const res = await this.api.getSecret(secretName, ref.version ?? 'latest');
    return {
      version: res.version,
      expiresAt: res.expiresAt,
      provider: 'doppler',
    };
  }
}
