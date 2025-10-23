/**
 * Logging infrastructure constants
 *
 * This file defines ONLY shared logging infrastructure concerns.
 * Business-specific constants are defined in app.constants.ts
 */

import { SERVICE_METADATA } from '../../app.constants';
import { AppConfigUtil } from '../config/app-config.util';

// ✨ Service-level logging metadata (combines infrastructure + business)
export const SERVICE_LOGGING_METADATA = {
  service: SERVICE_METADATA.name,
  environment: AppConfigUtil.getEnvironment(),
  version: SERVICE_METADATA.version,
} as const;
