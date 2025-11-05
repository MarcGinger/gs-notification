import { Injectable } from '@nestjs/common';
import { SecretRefError } from '../secret-ref.types';

@Injectable()
export class SecretRefConfigValidator {
  validate() {
    const required = ['DOPPLER_TOKEN', 'DOPPLER_PROJECT', 'DOPPLER_CONFIG'];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new SecretRefError(
        `Missing required environment variables: ${missing.join(', ')}`,
        'CONFIG_ERROR',
      );
    }

    // Validate token format (basic check)
    const token = process.env.DOPPLER_TOKEN;
    if (token && !token.startsWith('dp.st.')) {
      throw new SecretRefError(
        'DOPPLER_TOKEN appears to be invalid (should start with dp.st.)',
        'CONFIG_ERROR',
      );
    }
  }
}
