import { Result, DomainError } from '../../errors';
import { AppConfig, Environment } from '../app-config.schema';

/**
 * Configuration load result with detailed information
 */
export interface ConfigLoadDetails {
  config: AppConfig;
  source: 'doppler' | 'env' | 'mixed';
  errors: string[];
  warnings: string[];
  dopplerAvailable: boolean;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationDetails {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  environment?: Environment;
}

/**
 * Type alias for configuration operations that may fail
 */
export type ConfigResult<T = ConfigLoadDetails> = Result<T, DomainError>;

/**
 * Type alias for configuration loading operations
 */
export type ConfigLoadResult = Result<ConfigLoadDetails, DomainError>;

/**
 * Type alias for configuration validation operations
 */
export type ConfigValidationResult = Result<
  ConfigValidationDetails,
  DomainError
>;
