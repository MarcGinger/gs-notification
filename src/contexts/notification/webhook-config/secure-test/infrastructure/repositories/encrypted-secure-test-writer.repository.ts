import { Injectable } from '@nestjs/common';
import { ActorContext } from 'src/shared/application/context';
import { Result, DomainError } from 'src/shared/errors';
import { SaveReceipt } from 'src/shared/infrastructure/repositories';
import { SecureTestAggregate } from '../../domain/aggregates';
import { SecureTestId } from '../../domain/value-objects';
import { ISecureTestWriter } from '../../application/ports';
import { SecureTestWriterRepository } from './secure-test-kurrentdb-writer.repository';
import {
  SecretRefUnion,
  createDopplerSecretRef,
  createSealedSecretRef,
  isDopplerSecretRef,
  isSealedSecretRef,
} from 'src/shared/infrastructure/secret-ref/domain/sealed-secret-ref.types';
import { DomainEvent } from 'src/shared/domain/events';

/**
 * Encrypted SecureTest Writer Repository - DDD Infrastructure Adapter
 * 
 * Follows DDD principles by keeping domain pure and handling encryption transparently.
 * 
 * Domain Layer: Works with pure business values (plaintext strings)
 * Infrastructure Layer: Handles encryption/decryption automatically
 * Application Layer: Coordinates between domain and infrastructure
 * 
 * This adapter intercepts events before persistence and encrypts sensitive fields,
 * while keeping the domain layer completely unaware of encryption concerns.
 */
@Injectable()
export class EncryptedSecureTestWriterRepository implements ISecureTestWriter {
  constructor(
    private readonly inner: SecureTestWriterRepository,
    // TODO: Inject actual encryption service when available
    // private readonly crypto: CryptoAdapter,
  ) {}

  /**
   * Save aggregate with automatic encryption of sensitive fields
   * Domain layer provides plaintext business values
   * Infrastructure layer handles encryption transparently
   */
  async save(
    actor: ActorContext,
    secureTest: SecureTestAggregate,
    expectedVersionFromCaller?: number,
  ): Promise<Result<SaveReceipt, DomainError>> {
    // Intercept uncommitted events and encrypt sensitive fields
    const encryptedAggregate = this.encryptSensitiveFields(secureTest, actor);
    
    // Delegate to inner repository with encrypted data
    return this.inner.save(actor, encryptedAggregate, expectedVersionFromCaller);
  }

  /**
   * Delete aggregate (no encryption needed for delete operations)
   */
  async delete(
    actor: ActorContext,
    id: SecureTestId,
    opts?: {
      expectedVersion?: number;
      meta?: {
        correlationId?: string;
        causationId?: string;
        commandId?: string;
      };
    },
  ): Promise<Result<SaveReceipt, DomainError>> {
    return this.inner.delete(actor, id, opts);
  }

  /**
   * Encrypt sensitive fields in domain events before persistence
   * Domain provides plaintext business values, infrastructure creates SecretRefs
   */
  private encryptSensitiveFields(
    aggregate: SecureTestAggregate,
    actor: ActorContext,
  ): SecureTestAggregate {
    const events = aggregate.uncommittedEvents;
    if (!events || events.length === 0) {
      return aggregate;
    }

    // Create new aggregate instance with encrypted events
    const encryptedEvents = events.map(event => this.encryptEventData(event, actor));
    
    // Clone aggregate with encrypted events
    // Note: This is a simplified approach - in real implementation,
    // we'd need to properly clone the aggregate state
    const clonedAggregate = Object.create(Object.getPrototypeOf(aggregate));
    Object.assign(clonedAggregate, aggregate);
    
    // Replace uncommitted events with encrypted versions
    (clonedAggregate as any)._uncommittedEvents = encryptedEvents;
    
    return clonedAggregate;
  }

  /**
   * Encrypt sensitive fields in a single domain event
   * Converts plaintext business values to SecretRef objects
   */
  private encryptEventData(event: DomainEvent, actor: ActorContext): DomainEvent {
    const eventData = event.data as any;
    
    // Only encrypt if event contains sensitive fields
    if (!this.hasSensitiveFields(eventData)) {
      return event;
    }

    const encryptedData = { ...eventData };

    // Encrypt signing secret if present
    if (eventData.signingSecret && typeof eventData.signingSecret === 'string') {
      encryptedData.signingSecret = this.createSecretRef(
        eventData.signingSecret,
        actor.tenant,
        'signing',
      );
    }

    // Encrypt username if present  
    if (eventData.username && typeof eventData.username === 'string') {
      encryptedData.username = this.createSecretRef(
        eventData.username,
        actor.tenant,
        'auth',
      );
    }

    // Encrypt password if present
    if (eventData.password && typeof eventData.password === 'string') {
      encryptedData.password = this.createSecretRef(
        eventData.password,
        actor.tenant,
        'auth',
      );
    }

    return {
      ...event,
      data: encryptedData,
    };
  }

  /**
   * Check if event data contains sensitive fields that need encryption
   */
  private hasSensitiveFields(eventData: any): boolean {
    return !!(
      eventData?.signingSecret ||
      eventData?.username ||
      eventData?.password
    );
  }

  /**
   * Create SecretRef for sensitive data
   * TODO: Use actual encryption service instead of mock Doppler refs
   */
  private createSecretRef(
    plaintextValue: string,
    tenant: string,
    namespace: string,
  ): SecretRefUnion {
    // TODO: In real implementation, this would:
    // 1. Encrypt the plaintext value using the crypto service
    // 2. Store encrypted value in appropriate secret store (Doppler, Sealed, etc.)
    // 3. Return appropriate SecretRef type based on configuration
    
    // For now, create Doppler SecretRef as placeholder
    return createDopplerSecretRef(
      tenant,
      namespace,
      plaintextValue, // In real implementation, this would be the encrypted key reference
      { version: '1.0.0', algHint: 'HMAC-SHA256' },
    );
  }
}