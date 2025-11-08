/**
 * Practical Example: Encryption Strategy Observability in Action
 * 
 * This demonstrates how to observe which encryption strategy is being applied
 * in your gs-notification service using the EventEncryptionFactory.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEncryptionFactory } from './src/shared/infrastructure/encryption/event-encryption.factory';
import { ActorContext } from './src/shared/application/context';

@Injectable()
export class EncryptionStrategyMonitor {
  private readonly logger = new Logger(EncryptionStrategyMonitor.name);

  constructor(private readonly encryptionFactory: EventEncryptionFactory) {}

  /**
   * Method 1: Inspect the EncryptionResult metadata to see which strategy was used
   */
  async monitorWebhookEncryption(webhookData: any, actor: ActorContext) {
    // Create PII config for webhook data
    const config = EventEncryptionFactory.createPIIConfig({
      domain: 'notification',
      tenant: actor.tenant
    });

    // Encrypt and get detailed metadata
    const result = await this.encryptionFactory.encryptEvents([webhookData], actor, config);
    
    // Log which strategy was actually used
    this.logger.log(`Encryption Strategy Applied: ${result.metadata.encryptionType}`);
    this.logger.log(`Events Processed: ${result.metadata.processedEventCount}`);
    this.logger.log(`Events Encrypted: ${result.metadata.encryptedEventCount}`);
    this.logger.log(`Events Skipped: ${result.metadata.skippedEventCount}`);
    this.logger.log(`Algorithm Used: ${result.metadata.algorithm}`);
    this.logger.log(`Fields Encrypted: ${JSON.stringify(result.metadata.encryptedFields)}`);
    
    // Detailed strategy metadata
    result.metadata.strategyMetadata.forEach((strategyMeta, index) => {
      this.logger.log(`Strategy ${index + 1} Details:`);
      this.logger.log(`  - Algorithm: ${strategyMeta.algorithm}`);
      this.logger.log(`  - Key ID: ${strategyMeta.keyId}`);
      this.logger.log(`  - Tenant: ${strategyMeta.tenant}`);
      this.logger.log(`  - Operation: ${strategyMeta.operationType}`);
      this.logger.log(`  - Fields Processed: ${JSON.stringify(strategyMeta.processedFields)}`);
    });

    return result;
  }

  /**
   * Method 2: Compare different strategies to see which one gets applied
   */
  async compareStrategyBehavior(eventData: any, actor: ActorContext) {
    this.logger.log('=== Strategy Comparison ===');

    // Test No-op strategy
    const noopResult = await this.encryptionFactory.encryptEvents(
      [eventData], 
      actor, 
      EventEncryptionFactory.createNoopConfig()
    );
    this.logger.log(`NOOP: ${noopResult.metadata.encryptedEventCount} encrypted, ${noopResult.metadata.skippedEventCount} skipped`);

    // Test PII strategy
    const piiResult = await this.encryptionFactory.encryptEvents(
      [eventData], 
      actor, 
      EventEncryptionFactory.createPIIConfig({ domain: 'notification' })
    );
    this.logger.log(`PII: ${piiResult.metadata.encryptedEventCount} encrypted, ${piiResult.metadata.skippedEventCount} skipped`);

    // Test SecretRef strategy
    const secretResult = await this.encryptionFactory.encryptEvents(
      [eventData], 
      actor, 
      EventEncryptionFactory.createSecretConfig()
    );
    this.logger.log(`SECRET: ${secretResult.metadata.encryptedEventCount} encrypted, ${secretResult.metadata.skippedEventCount} skipped`);

    return {
      noop: noopResult.metadata,
      pii: piiResult.metadata,
      secret: secretResult.metadata
    };
  }

  /**
   * Method 3: Get all available strategies
   */
  listAvailableStrategies(): string[] {
    const strategies = this.encryptionFactory.getAvailableStrategies();
    this.logger.log(`Available Encryption Strategies: ${strategies.join(', ')}`);
    return strategies;
  }

  /**
   * Method 4: Strategy Detection from Configuration
   */
  identifyConfigurationStrategy(config: any): string {
    const strategyDescriptions = {
      'noop': 'No Encryption (Development/Testing)',
      'pii': 'PII Field Classification & Encryption',
      'secret': 'Secret Reference Adapter',
      'doppler': 'Doppler Secrets Management',
      'env': 'Environment Variable Encryption',
      'hybrid': 'Multi-Strategy Pipeline',
      'custom': 'Custom Strategy Implementation'
    };

    const strategy = config?.type || 'unknown';
    const description = strategyDescriptions[strategy as keyof typeof strategyDescriptions] || 'Unknown Strategy';
    
    this.logger.log(`Configuration indicates strategy: ${strategy} - ${description}`);
    return description;
  }

  /**
   * Method 5: Runtime Strategy Validation
   */
  async validateExpectedStrategy(
    data: any, 
    actor: ActorContext, 
    config: any, 
    expectedStrategy: string
  ): Promise<boolean> {
    const result = await this.encryptionFactory.encryptEvents([data], actor, config);
    const actualStrategy = result.metadata.encryptionType;
    
    if (actualStrategy !== expectedStrategy) {
      this.logger.warn(`Strategy Mismatch! Expected: ${expectedStrategy}, Got: ${actualStrategy}`);
      return false;
    }
    
    this.logger.log(`✅ Strategy validation passed: ${actualStrategy}`);
    return true;
  }
}

/**
 * Usage in your webhook repository or service:
 */
export class WebhookEncryptionExample {
  constructor(
    private readonly encryptionFactory: EventEncryptionFactory,
    private readonly monitor: EncryptionStrategyMonitor
  ) {}

  async processWebhookWithObservability(webhookPayload: any, actor: ActorContext) {
    // 1. Monitor which strategy gets applied
    const encryptionResult = await this.monitor.monitorWebhookEncryption(webhookPayload, actor);
    
    // 2. Log the results for observability
    console.log('Applied Strategy:', encryptionResult.metadata.encryptionType);
    console.log('Fields Processed:', encryptionResult.metadata.encryptedFields);
    
    // 3. Use the encrypted data
    return encryptionResult.events[0];
  }
}

export { EncryptionStrategyMonitor };