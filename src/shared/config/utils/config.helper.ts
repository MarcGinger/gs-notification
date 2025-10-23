import {
  Result,
  ok,
  err,
  fromError,
  withContext,
  DomainError,
} from '../../errors';
import { ConfigErrors, ConfigContext } from '../errors/config.errors';
import { AppConfig } from '../app-config.schema';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Helper utilities for configuration loading and validation
 */
export class ConfigHelper {
  /**
   * Safely checks if Doppler CLI is available
   */
  static async checkDopplerAvailability(
    context: ConfigContext = {},
  ): Promise<Result<boolean, DomainError>> {
    try {
      const dopplerCmd =
        process.platform === 'win32' ? '.\\doppler.bat' : 'doppler';
      await execAsync(`${dopplerCmd} me --json`);
      return ok(true);
    } catch (error) {
      return err(
        fromError(ConfigErrors.DOPPLER_UNAVAILABLE, error, {
          ...context,
          platform: process.platform,
        }),
      );
    }
  }

  /**
   * Safely loads configuration from Doppler
   */
  static async loadFromDoppler(
    project: string,
    config: string,
    context: ConfigContext = {},
  ): Promise<Result<Record<string, string>, DomainError>> {
    try {
      const dopplerCmd =
        process.platform === 'win32' ? '.\\doppler.bat' : 'doppler';
      const command = `${dopplerCmd} secrets --project ${project} --config ${config} --json`;
      const { stdout } = await execAsync(command);

      const secrets = JSON.parse(stdout) as Record<string, unknown>;

      // Convert to flat key-value pairs, extracting actual values
      const result: Record<string, string> = {};
      for (const [key, value] of Object.entries(secrets)) {
        if (
          typeof value === 'object' &&
          value !== null &&
          'computed' in value
        ) {
          // Handle Doppler CLI output format
          const computedValue = (value as { computed: unknown }).computed;
          result[key] = String(computedValue);
        } else {
          result[key] = String(value);
        }
      }

      return ok(result);
    } catch (error) {
      return err(
        fromError(ConfigErrors.DOPPLER_LOAD_FAILED, error, {
          ...context,
          dopplerProject: project,
          dopplerConfig: config,
        }),
      );
    }
  }

  /**
   * Safely loads configuration from environment variables
   */
  static loadFromEnv(
    context: ConfigContext = {},
  ): Result<Record<string, string>, DomainError> {
    try {
      const result: Record<string, string> = {};

      // Get all environment variables that match our schema
      for (const key of Object.keys(process.env)) {
        const value = process.env[key];
        if (value !== undefined) {
          result[key] = value;
        }
      }

      return ok(result);
    } catch (error) {
      return err(
        fromError(ConfigErrors.PARSING_FAILED, error, {
          ...context,
          source: 'env',
        }),
      );
    }
  }

  /**
   * Safely validates configuration schema
   */
  static validateConfigSchema(
    rawConfig: Record<string, string>,
    // Accept a minimal schema-like shape with a parse method to avoid any typings flowing
    schema: { parse: (input: unknown) => unknown },
    context: ConfigContext = {},
  ): Result<AppConfig, DomainError> {
    try {
      const config = schema.parse(rawConfig) as AppConfig;
      return ok(config);
    } catch (zodError: unknown) {
      const parseErrors: string[] = [];

      if (zodError && typeof zodError === 'object' && 'errors' in zodError) {
        const zodErrorObj = zodError as {
          errors?: Array<{ path: string[]; message: string }>;
        };
        if (zodErrorObj.errors) {
          parseErrors.push(
            ...zodErrorObj.errors.map(
              (e) => `${e.path.join('.')}: ${e.message}`,
            ),
          );
        }
      } else {
        parseErrors.push(String(zodError));
      }

      return err(
        withContext(ConfigErrors.VALIDATION_FAILED, {
          ...context,
          validationErrors: parseErrors,
          errorCount: parseErrors.length,
        }),
      );
    }
  }

  /**
   * Safely extracts error message from domain error
   */
  static getErrorMessage(error: DomainError): string {
    return error.detail || error.title || 'Unknown error';
  }

  /**
   * Safely extracts multiple error messages from domain errors
   */
  static getErrorMessages(errors: DomainError[]): string[] {
    return errors.map((error) => this.getErrorMessage(error));
  }
}
