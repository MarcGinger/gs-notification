/**
 * Hybrid Encryption Strategy
 *
 * Combines multiple encryption strategies in a pipeline.
 * Allows layered encryption for enhanced security.
 *
 * @domain Shared Infrastructure - Hybrid Encryption Strategy
 * @layer Infrastructure
 * @pattern Strategy Pattern + Composite Pattern
 */

import { Injectable } from '@nestjs/common';
import {
  EncryptionStrategy,
  EncryptionContext,
  EncryptedPayload,
  DecryptedPayload,
  EncryptionMetadata,
} from '../interfaces/event-encryption-factory.interface';

export interface HybridConfig {
  strategies: EncryptionStrategy[];
  mode: 'sequential' | 'parallel';
}

@Injectable()
export class HybridStrategy implements EncryptionStrategy {
  readonly name = 'hybrid';
  readonly version = '1.0.0';

  constructor(private readonly config: HybridConfig) {}

  /**
   * Encrypt data using multiple strategies
   */
  async encrypt<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<EncryptedPayload<T>> {
    if (this.config.strategies.length === 0) {
      return {
        data: payload,
        metadata: {
          encrypted: false,
          processedFields: [],
        },
      };
    }

    if (this.config.mode === 'sequential') {
      return this.encryptSequential(payload, context);
    } else {
      return this.encryptParallel(payload, context);
    }
  }

  /**
   * Decrypt data using multiple strategies (reverse order)
   */
  async decrypt<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<DecryptedPayload<T>> {
    if (this.config.strategies.length === 0) {
      return {
        data: payload,
        metadata: {
          decrypted: false,
          processedFields: [],
        },
      };
    }

    if (this.config.mode === 'sequential') {
      return this.decryptSequential(payload, context);
    } else {
      return this.decryptParallel(payload, context);
    }
  }

  /**
   * Generate composite metadata for hybrid operations
   */
  getMetadata(
    context: EncryptionContext,
    operationType: 'encrypt' | 'decrypt',
  ): EncryptionMetadata {
    return {
      algorithm: `hybrid-${this.config.mode}`,
      keyId: `tenant:${context.tenant}:hybrid`,
      tenant: context.tenant,
      namespace: 'hybrid',
      timestamp: context.timestamp.toISOString(),
      source: 'hybrid-strategy',
      processedFields: [], // Will be aggregated from all strategies
      strategyVersion: this.version,
      operationType,
    };
  }

  /**
   * Check if hybrid strategy can handle the payload
   */
  canHandle<T>(payload: T, context: EncryptionContext): boolean {
    return this.config.strategies.some((strategy) =>
      strategy.canHandle(payload, context),
    );
  }

  /**
   * Encrypt using strategies in sequence
   */
  private async encryptSequential<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<EncryptedPayload<T>> {
    let currentPayload = payload;
    const allProcessedFields: string[] = [];
    let encrypted = false;

    for (const strategy of this.config.strategies) {
      if (strategy.canHandle(currentPayload, context)) {
        const result = await strategy.encrypt(currentPayload, context);
        currentPayload = result.data;
        allProcessedFields.push(...(result.metadata.processedFields || []));
        encrypted = encrypted || result.metadata.encrypted;
      }
    }

    return {
      data: currentPayload,
      metadata: {
        encrypted,
        algorithm: `hybrid-sequential`,
        keyId: `tenant:${context.tenant}:hybrid`,
        processedFields: [...new Set(allProcessedFields)],
      },
    };
  }

  /**
   * Decrypt using strategies in reverse sequence
   */
  private async decryptSequential<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<DecryptedPayload<T>> {
    let currentPayload = payload;
    const allProcessedFields: string[] = [];
    let decrypted = false;

    // Reverse order for decryption
    const reversedStrategies = [...this.config.strategies].reverse();

    for (const strategy of reversedStrategies) {
      // For decryption, we assume all strategies can handle the payload
      const result = await strategy.decrypt(currentPayload, context);
      currentPayload = result.data;
      allProcessedFields.push(...(result.metadata.processedFields || []));
      decrypted = decrypted || result.metadata.decrypted;
    }

    return {
      data: currentPayload,
      metadata: {
        decrypted,
        algorithm: `hybrid-sequential`,
        keyId: `tenant:${context.tenant}:hybrid`,
        processedFields: [...new Set(allProcessedFields)],
      },
    };
  }

  /**
   * Encrypt using strategies in parallel
   */
  private async encryptParallel<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<EncryptedPayload<T>> {
    const applicableStrategies = this.config.strategies.filter((strategy) =>
      strategy.canHandle(payload, context),
    );

    if (applicableStrategies.length === 0) {
      return {
        data: payload,
        metadata: {
          encrypted: false,
          processedFields: [],
        },
      };
    }

    // For parallel mode, we need to clone the payload for each strategy
    // This is a simplified implementation - in practice, you'd need deep cloning
    const results = await Promise.all(
      applicableStrategies.map((strategy) =>
        strategy.encrypt(payload, context),
      ),
    );

    // Combine results - this is strategy-specific logic
    // For now, return the last result
    const lastResult = results[results.length - 1];
    const allProcessedFields = results.flatMap(
      (r) => r.metadata.processedFields || [],
    );

    return {
      data: lastResult.data,
      metadata: {
        encrypted: results.some((r) => r.metadata.encrypted),
        algorithm: `hybrid-parallel`,
        keyId: `tenant:${context.tenant}:hybrid`,
        processedFields: [...new Set(allProcessedFields)],
      },
    };
  }

  /**
   * Decrypt using strategies in parallel
   */
  private async decryptParallel<T>(
    payload: T,
    context: EncryptionContext,
  ): Promise<DecryptedPayload<T>> {
    // For parallel decryption, apply all strategies
    const results = await Promise.all(
      this.config.strategies.map((strategy) =>
        strategy.decrypt(payload, context),
      ),
    );

    // Combine results - this is strategy-specific logic
    // For now, return the last result
    const lastResult = results[results.length - 1];
    const allProcessedFields = results.flatMap(
      (r) => r.metadata.processedFields || [],
    );

    return {
      data: lastResult.data,
      metadata: {
        decrypted: results.some((r) => r.metadata.decrypted),
        algorithm: `hybrid-parallel`,
        keyId: `tenant:${context.tenant}:hybrid`,
        processedFields: [...new Set(allProcessedFields)],
      },
    };
  }
}
