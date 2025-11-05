import { Injectable } from '@nestjs/common';
import { DopplerProvider } from './doppler.provider';

@Injectable()
export class ProviderRegistry {
  constructor(private readonly doppler: DopplerProvider) {}

  get(provider: 'doppler') {
    if (provider === 'doppler') return this.doppler;
    throw new Error(`Unknown provider: ${provider}`);
  }
}
