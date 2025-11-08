/**
 * Event Encryption Factory - Observability Examples
 * 
 * This file demonstrates how to identify which encryption strategy is being applied
 * and monitor encryption operations across the system.
 */

import { EventEncryptionFactory } from './src/shared/infrastructure/encryption/event-encryption.factory';
import { ActorContext } from './src/shared/application/context';
import { DomainEvent } from './src/shared/domain/events';

// Example: Identifying Strategy from Operation Results
async function demonstrateStrategyObservability(
  factory: EventEncryptionFactory,
  events: DomainEvent[],
  actor: ActorContext
) {
  
  // 1. PII Encryption Strategy
  console.log('=== PII Encryption Strategy ===');
  const piiConfig = EventEncryptionFactory.createPIIConfig({
    domain: 'notification',
    tenant: actor.tenant
  });
  
  const piiResult = await factory.encryptEvents(events, actor, piiConfig);
  console.log('Strategy Type:', piiResult.metadata.encryptionType); // 'pii'
  console.log('Processed Events:', piiResult.metadata.processedEventCount);
  console.log('Encrypted Events:', piiResult.metadata.encryptedEventCount);
  console.log('Algorithm Used:', piiResult.metadata.algorithm);
  console.log('Encrypted Fields:', piiResult.metadata.encryptedFields);
  console.log('Strategy Metadata:', piiResult.metadata.strategyMetadata);
  
  
  // 2. SecretRef Strategy
  console.log('\n=== SecretRef Strategy ===');
  const secretConfig = EventEncryptionFactory.createSecretConfig({
    sensitiveFields: ['signingSecret', 'apiKey'],
    namespaceMap: { 
      signingSecret: 'webhook',
      apiKey: 'external-service' 
    }
  });
  
  const secretResult = await factory.encryptEvents(events, actor, secretConfig);
  console.log('Strategy Type:', secretResult.metadata.encryptionType); // 'secret'
  console.log('Algorithm Used:', secretResult.metadata.algorithm);
  console.log('Encrypted Fields:', secretResult.metadata.encryptedFields);
  
  
  // 3. No-op Strategy (Development/Testing)
  console.log('\n=== No-op Strategy ===');
  const noopConfig = EventEncryptionFactory.createNoopConfig();
  
  const noopResult = await factory.encryptEvents(events, actor, noopConfig);
  console.log('Strategy Type:', noopResult.metadata.encryptionType); // 'noop'
  console.log('Encrypted Events:', noopResult.metadata.encryptedEventCount); // 0
  console.log('Skipped Events:', noopResult.metadata.skippedEventCount); // all events
  
  
  // 4. Check Available Strategies
  console.log('\n=== Available Strategies ===');
  const availableStrategies = factory.getAvailableStrategies();
  console.log('Registered Strategies:', availableStrategies); // ['noop', 'secret', 'pii']
  
  
  // 5. Strategy Metadata Deep Dive
  console.log('\n=== Detailed Strategy Metadata ===');
  piiResult.metadata.strategyMetadata.forEach((strategyMeta, index) => {
    console.log(`Strategy ${index + 1}:`);
    console.log('  Algorithm:', strategyMeta.algorithm);
    console.log('  Key ID:', strategyMeta.keyId);
    console.log('  Tenant:', strategyMeta.tenant);
    console.log('  Namespace:', strategyMeta.namespace);
    console.log('  Timestamp:', strategyMeta.timestamp);
    console.log('  Source:', strategyMeta.source);
    console.log('  Processed Fields:', strategyMeta.processedFields);
    console.log('  Strategy Version:', strategyMeta.strategyVersion);
    console.log('  Operation Type:', strategyMeta.operationType);
  });
}

// Example: Configuration-Based Strategy Detection
function identifyStrategyFromConfig(config: any): string {
  const strategyTypeMap = {
    'noop': 'No encryption (development/testing)',
    'pii': 'PII field encryption with classification',
    'secret': 'SecretRef adapter for sensitive fields',
    'doppler': 'Doppler secrets management',
    'env': 'Environment variable encryption',
    'hybrid': 'Multi-strategy pipeline',
    'custom': 'Custom encryption strategy'
  };
  
  return strategyTypeMap[config.type] || 'Unknown strategy';
}

// Example: Logging Integration for Strategy Monitoring
class EncryptionObserver {
  logStrategyUsage(operationType: 'encrypt' | 'decrypt', result: any) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation: operationType,
      strategy: result.metadata.encryptionType,
      processed: result.metadata.processedEventCount,
      affected: operationType === 'encrypt' 
        ? result.metadata.encryptedEventCount 
        : result.metadata.decryptedEventCount,
      skipped: result.metadata.skippedEventCount,
      algorithm: result.metadata.algorithm,
      fields: operationType === 'encrypt' 
        ? result.metadata.encryptedFields 
        : result.metadata.decryptedFields
    };
    
    console.log(`[ENCRYPTION_MONITOR] ${JSON.stringify(logEntry)}`);
  }
}

// Example: Runtime Strategy Validation
function validateExpectedStrategy(result: any, expectedStrategy: string): boolean {
  const actualStrategy = result.metadata.encryptionType;
  if (actualStrategy !== expectedStrategy) {
    console.warn(`Strategy mismatch! Expected: ${expectedStrategy}, Got: ${actualStrategy}`);
    return false;
  }
  return true;
}

// Example: Performance Monitoring by Strategy
class StrategyPerformanceMonitor {
  private metrics = new Map<string, { calls: number; totalTime: number }>();
  
  async measureStrategy<T>(
    strategyName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const existing = this.metrics.get(strategyName) || { calls: 0, totalTime: 0 };
    this.metrics.set(strategyName, {
      calls: existing.calls + 1,
      totalTime: existing.totalTime + duration
    });
    
    console.log(`[PERF] ${strategyName}: ${duration}ms`);
    return result;
  }
  
  getPerformanceReport(): Record<string, { avgTime: number; totalCalls: number }> {
    const report: Record<string, { avgTime: number; totalCalls: number }> = {};
    
    this.metrics.forEach((metrics, strategy) => {
      report[strategy] = {
        avgTime: metrics.totalTime / metrics.calls,
        totalCalls: metrics.calls
      };
    });
    
    return report;
  }
}

export {
  demonstrateStrategyObservability,
  identifyStrategyFromConfig,
  EncryptionObserver,
  validateExpectedStrategy,
  StrategyPerformanceMonitor
};