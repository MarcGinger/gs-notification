import { DomainError } from '../../errors';

/**
 * Context information for configuration errors
 */
export interface ConfigContext extends Record<string, unknown> {
  source?: 'doppler' | 'env' | 'mixed';
  configKey?: string;
  dopplerProject?: string;
  dopplerConfig?: string;
  environment?: string;
  validationPath?: string;
}

/**
 * Configuration error catalog
 *
 * Provides standardized errors for configuration loading, validation, and management.
 */
export const ConfigErrors = {
  /**
   * Failed to load configuration from Doppler
   */
  DOPPLER_LOAD_FAILED: {
    code: 'CONFIG.DOPPLER_LOAD_FAILED',
    title: 'Doppler Configuration Load Failed',
    detail: 'Unable to load configuration from Doppler secrets management',
    category: 'infrastructure',
    retryable: true,
  } as DomainError<'CONFIG.DOPPLER_LOAD_FAILED', ConfigContext>,

  /**
   * Doppler CLI is not available or not configured
   */
  DOPPLER_UNAVAILABLE: {
    code: 'CONFIG.DOPPLER_UNAVAILABLE',
    title: 'Doppler CLI Unavailable',
    detail: 'Doppler CLI is not installed or not properly configured',
    category: 'infrastructure',
    retryable: false,
  } as DomainError<'CONFIG.DOPPLER_UNAVAILABLE', ConfigContext>,

  /**
   * Configuration validation failed
   */
  VALIDATION_FAILED: {
    code: 'CONFIG.VALIDATION_FAILED',
    title: 'Configuration Validation Failed',
    detail: 'Configuration does not meet the required schema or constraints',
    category: 'validation',
    retryable: false,
  } as DomainError<'CONFIG.VALIDATION_FAILED', ConfigContext>,

  /**
   * Environment configuration is invalid
   */
  ENVIRONMENT_INVALID: {
    code: 'CONFIG.ENVIRONMENT_INVALID',
    title: 'Environment Configuration Invalid',
    detail: 'Configuration is not valid for the specified environment',
    category: 'validation',
    retryable: false,
  } as DomainError<'CONFIG.ENVIRONMENT_INVALID', ConfigContext>,

  /**
   * Required configuration missing
   */
  REQUIRED_CONFIG_MISSING: {
    code: 'CONFIG.REQUIRED_CONFIG_MISSING',
    title: 'Required Configuration Missing',
    detail: 'One or more required configuration values are missing',
    category: 'validation',
    retryable: false,
  } as DomainError<'CONFIG.REQUIRED_CONFIG_MISSING', ConfigContext>,

  /**
   * Configuration parsing error
   */
  PARSING_FAILED: {
    code: 'CONFIG.PARSING_FAILED',
    title: 'Configuration Parsing Failed',
    detail: 'Unable to parse configuration from the source',
    category: 'validation',
    retryable: false,
  } as DomainError<'CONFIG.PARSING_FAILED', ConfigContext>,
};
