/**
 * Event Encryption Module
 *
 * NestJS dynamic module for registering encryption strategies and factory.
 * Provides clean dependency injection and configuration for encryption services.
 *
 * @domain Shared Infrastructure - Event Encryption Module
 * @layer Infrastructure
 * @pattern Dynamic Module Pattern
 */

import { DynamicModule, Module, Provider } from '@nestjs/common';
import { EventEncryptionFactory } from './event-encryption.factory';
import { NoopStrategy, SecretRefStrategy, PIIStrategy } from './strategies';
import { EventEncryptionService } from '../secret-ref/infrastructure/event-encryption.service';

/**
 * Configuration options for the encryption module
 */
export interface EncryptionModuleOptions {
  strategies?: {
    enableNoop?: boolean;
    enableSecretRef?: boolean;
    enablePII?: boolean;
    enableHybrid?: boolean;
  };
  customStrategies?: Provider[];
}

@Module({})
export class EventEncryptionModule {
  /**
   * Register the encryption module with default strategies
   */
  static register(options: EncryptionModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [];

    // Default strategy options
    const strategyOptions = {
      enableNoop: true,
      enableSecretRef: true,
      enablePII: true,
      enableHybrid: true,
      ...options.strategies,
    };

    // Register core strategies
    if (strategyOptions.enableNoop) {
      providers.push(NoopStrategy);
    }

    if (strategyOptions.enableSecretRef) {
      providers.push(SecretRefStrategy);
      // SecretRef strategy depends on EventEncryptionService
      providers.push(EventEncryptionService);
    }

    if (strategyOptions.enablePII) {
      providers.push(PIIStrategy);
    }

    // Note: HybridStrategy is not registered as a provider since it's instantiated
    // dynamically with configuration when needed in EventEncryptionFactory

    // Add custom strategies if provided
    if (options.customStrategies) {
      providers.push(...options.customStrategies);
    }

    // Register the main factory
    providers.push(EventEncryptionFactory);

    return {
      module: EventEncryptionModule,
      providers,
      exports: [EventEncryptionFactory],
    };
  }

  /**
   * Register the encryption module asynchronously
   */
  static registerAsync(options: {
    useFactory?: (
      ...args: any[]
    ) => EncryptionModuleOptions | Promise<EncryptionModuleOptions>;
    inject?: any[];
    imports?: any[];
  }): DynamicModule {
    const asyncProviders: Provider[] = [
      {
        provide: 'ENCRYPTION_MODULE_OPTIONS',
        useFactory: options.useFactory || (() => ({})),
        inject: options.inject || [],
      },
    ];

    return {
      module: EventEncryptionModule,
      imports: options.imports || [],
      providers: [
        ...asyncProviders,
        {
          provide: EventEncryptionFactory,
          useFactory: (moduleOptions: EncryptionModuleOptions) => {
            // This would create the factory with dynamic options
            // For now, return a simple registration
            return this.register(moduleOptions);
          },
          inject: ['ENCRYPTION_MODULE_OPTIONS'],
        },
      ],
      exports: [EventEncryptionFactory],
    };
  }

  /**
   * Create a forRoot configuration for global module registration
   */
  static forRoot(options: EncryptionModuleOptions = {}): DynamicModule {
    return {
      ...this.register(options),
      global: true,
    };
  }
}
