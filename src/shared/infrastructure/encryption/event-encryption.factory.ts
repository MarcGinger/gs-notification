/**
 * Event Encryption Factory
 *
 * Unified factory for encrypting/decrypting domain events using multiple strategies.
 * Provides consistent interface across all repositories with bidirectional operations.
 *
 * @domain Shared Infrastructure - Event Encryption Factory
 * @layer Infrastructure
 * @pattern Factory Pattern + Strategy Pattern
 */

import { Injectable } from '@nestjs/common';
import {
  IEventEncryptionFactory,
  EncryptionStrategy,
  EncryptionContext,
  EncryptionResult,
  DecryptionResult,
} from './interfaces/event-encryption-factory.interface';
import {
  EncryptionConfig,
  EncryptionType,
  CompositeEncryptionConfig,
} from './encryption-config.types';
import { ActorContext } from 'src/shared/application/context';
import { DomainEvent } from 'src/shared/domain/events';
import {
  NoopStrategy,
  SecretRefStrategy,
  PIIStrategy,
  HybridStrategy,
} from './strategies';

@Injectable()
export class EventEncryptionFactory implements IEventEncryptionFactory {
  private readonly strategies = new Map<string, EncryptionStrategy>();

  constructor(
    private readonly noopStrategy: NoopStrategy,
    private readonly secretRefStrategy: SecretRefStrategy,
    private readonly piiStrategy: PIIStrategy,
  ) {
    this.registerDefaultStrategies();
  }

  /**
   * Encrypt events using the specified configuration
   */
  async encryptEvents<T = DomainEvent>(
    events: T[],
    actor: ActorContext,
    config: EncryptionConfig,
  ): Promise<EncryptionResult<T>> {
    const strategy = this.getStrategy(config);

    if (!strategy) {
      throw new Error(
        `No strategy found for configuration type: ${config.type}`,
      );
    }

    try {
      // Create encryption context
      const context: EncryptionContext = {
        actor,
        tenant: actor.tenant,
        timestamp: new Date(),
      };

      // Use strategy to encrypt
      const result = await strategy.encrypt(events, context);

      // Convert strategy result to factory result format
      return {
        events: result.data,
        metadata: {
          encryptionType: config.type,
          processedEventCount: events.length,
          encryptedEventCount: result.metadata.encrypted ? events.length : 0,
          skippedEventCount: result.metadata.encrypted ? 0 : events.length,
          algorithm: result.metadata.algorithm,
          encryptedFields: result.metadata.processedFields,
          strategyMetadata: [strategy.getMetadata(context, 'encrypt')],
        },
      };
    } catch (error) {
      throw new Error(
        `Encryption failed with ${config.type} strategy: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Decrypt events using the specified configuration
   */
  async decryptEvents<T = DomainEvent>(
    events: T[],
    actor: ActorContext,
    config: EncryptionConfig,
  ): Promise<DecryptionResult<T>> {
    const strategy = this.getStrategy(config);

    if (!strategy) {
      throw new Error(
        `No strategy found for configuration type: ${config.type}`,
      );
    }

    try {
      // Create encryption context
      const context: EncryptionContext = {
        actor,
        tenant: actor.tenant,
        timestamp: new Date(),
      };

      // Use strategy to decrypt
      const result = await strategy.decrypt(events, context);

      // Convert strategy result to factory result format
      return {
        events: result.data,
        metadata: {
          encryptionType: config.type,
          processedEventCount: events.length,
          decryptedEventCount: result.metadata.decrypted ? events.length : 0,
          skippedEventCount: result.metadata.decrypted ? 0 : events.length,
          algorithm: result.metadata.algorithm,
          decryptedFields: result.metadata.processedFields,
          strategyMetadata: [strategy.getMetadata(context, 'decrypt')],
        },
      };
    } catch (error) {
      throw new Error(
        `Decryption failed with ${config.type} strategy: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Register a custom strategy
   */
  registerStrategy(strategy: EncryptionStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get available strategy names
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Static helper to create no-op configuration
   */
  static createNoopConfig(): EncryptionConfig {
    return {
      type: 'noop',
    };
  }

  /**
   * Static helper to create SecretRef configuration
   */
  static createSecretConfig(options?: {
    sensitiveFields?: string[];
    namespaceMap?: Record<string, string>;
    defaultNamespace?: string;
  }): EncryptionConfig {
    return {
      type: 'secret',
      sensitiveFields: options?.sensitiveFields || [
        'signingSecret',
        'username',
        'password',
      ],
      namespaceMap: options?.namespaceMap || {
        signingSecret: 'signing',
        username: 'auth',
        password: 'auth',
      },
      defaultNamespace: options?.defaultNamespace || 'general',
    };
  }

  /**
   * Static helper to create PII configuration
   */
  static createPIIConfig(options: {
    domain: string;
    tenant?: string;
  }): EncryptionConfig {
    return {
      type: 'pii',
      domain: options.domain,
      tenant: options.tenant,
    };
  }

  /**
   * Static helper to create Doppler configuration
   */
  static createDopplerConfig(options?: {
    sensitiveFields?: string[];
    namespaceMap?: Record<string, string>;
    defaultNamespace?: string;
  }): EncryptionConfig {
    return {
      type: 'doppler',
      sensitiveFields: options?.sensitiveFields || [
        'signingSecret',
        'username',
        'password',
      ],
      namespaceMap: options?.namespaceMap || {
        signingSecret: 'signing',
        username: 'auth',
        password: 'auth',
      },
      defaultNamespace: options?.defaultNamespace || 'general',
    };
  }

  /**
   * Static helper to create Environment configuration
   */
  static createEnvConfig(options?: {
    envFields?: string[];
    keyPrefix?: string;
    keyManagement?: 'doppler' | 'aws-kms' | 'azure-keyvault';
  }): EncryptionConfig {
    return {
      type: 'env',
      envFields: options?.envFields || [],
      keyPrefix: options?.keyPrefix,
      keyManagement: options?.keyManagement,
    };
  }

  /**
   * Static helper to create Hybrid configuration
   */
  static createHybridConfig(
    pipeline: EncryptionType[],
    strategies: CompositeEncryptionConfig['strategies'] = {},
  ): EncryptionConfig {
    return {
      type: 'hybrid',
      pipeline,
      strategies,
    };
  }

  /**
   * Static helper to create custom configuration
   */
  static createCustomConfig(
    strategy: string,
    config: Record<string, unknown> = {},
  ): EncryptionConfig {
    return {
      type: 'custom',
      strategy,
      config,
    };
  }

  /**
   * Register default strategies
   */
  private registerDefaultStrategies(): void {
    this.strategies.set('noop', this.noopStrategy);
    this.strategies.set('secret', this.secretRefStrategy);
    this.strategies.set('pii', this.piiStrategy);
  }

  /**
   * Get strategy based on configuration
   */
  private getStrategy(config: EncryptionConfig): EncryptionStrategy | null {
    switch (config.type) {
      case 'noop':
        return this.strategies.get('noop') || null;

      case 'secret':
        return this.strategies.get('secret') || null;

      case 'pii':
        return this.strategies.get('pii') || null;

      case 'doppler':
        // TODO: Implement DopplerStrategy
        throw new Error('Doppler strategy not yet implemented');

      case 'env':
        // TODO: Implement EnvStrategy
        throw new Error('Environment strategy not yet implemented');

      case 'hybrid': {
        const hybridConfig = config as EncryptionConfig & {
          strategies: EncryptionConfig[];
          mode: 'sequential' | 'parallel';
        };
        const childStrategies = hybridConfig.strategies
          .map((strategyConfig) => this.getStrategy(strategyConfig))
          .filter(
            (strategy): strategy is EncryptionStrategy => strategy !== null,
          );

        if (childStrategies.length === 0) {
          throw new Error('No valid strategies found for hybrid configuration');
        }

        return new HybridStrategy({
          strategies: childStrategies,
          mode: hybridConfig.mode,
        });
      }

      case 'custom': {
        const customConfig = config as EncryptionConfig & {
          strategyName: string;
        };
        return this.strategies.get(customConfig.strategyName) || null;
      }

      default:
        return null;
    }
  }
}
