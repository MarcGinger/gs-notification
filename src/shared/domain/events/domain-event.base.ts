import { EventMetadata } from './event-metadata';

/**
 * Base domain event class with security and metadata support
 *
 * All domain events should extend this class to ensure consistent
 * metadata handling and security context support. This provides a
 * standard implementation that works with the consolidated EventMetadata
 * interface and supports the DomainEvent interface contract.
 */
export abstract class DomainEventBase {
  public readonly occurredAt: string;
  public readonly version: string = '1.0';

  constructor(
    public readonly type: string,
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly metadata: EventMetadata,
  ) {
    this.occurredAt = metadata.timestampIso;
  }

  // Method to enrich event with security context
  withSecurityContext(
    securityMetadata: Partial<{
      dataClassification: EventMetadata['dataClassification'];
      encryptionRequired: boolean;
    }>,
  ): this {
    if (securityMetadata.dataClassification) {
      this.metadata.dataClassification = securityMetadata.dataClassification;
    }
    if (securityMetadata.encryptionRequired !== undefined) {
      this.metadata.encryptionRequired = securityMetadata.encryptionRequired;
    }
    return this;
  }

  // Method to mark event as PII protected
  withPIIProtection(protectedFields: string[], encryptionKeyId?: string): this {
    this.metadata.encryptionRequired = true;
    const _meta = this.metadata as Record<string, unknown>;
    if (encryptionKeyId) {
      _meta['encryptionKeyId'] = encryptionKeyId;
    }
    _meta['piiFieldsProtected'] = protectedFields;
    _meta['dataProtectionApplied'] = true;
    return this;
  }

  // Abstract method to be implemented by concrete events
  abstract containsSensitiveData(): boolean;
  abstract getSensitiveFields(): string[];

  // Utility method to get correlation ID from metadata
  get correlationId(): string {
    return this.metadata.correlationId;
  }

  // Utility method to get user ID from metadata
  get userId(): string {
    return this.metadata.actor.userId;
  }

  // Utility method to get tenant ID from metadata
  get tenantId(): string | undefined {
    return this.metadata.actor.tenantId;
  }

  // Method to check if event is PII protected
  get isPIIProtected(): boolean {
    return this.metadata.encryptionRequired === true;
  }

  // Method to get security context
  get securityContext(): {
    dataClassification?: EventMetadata['dataClassification'];
    encryptionRequired?: boolean;
  } {
    return {
      dataClassification: this.metadata.dataClassification,
      encryptionRequired: this.metadata.encryptionRequired,
    };
  }

  // Method to convert to DomainEvent interface for aggregate usage
  toDomainEvent(data: Record<string, unknown>): {
    type: string;
    version: number;
    occurredAt: Date;
    aggregateId: string;
    aggregateType: string;
    data: Record<string, unknown>;
    metadata: EventMetadata;
  } {
    return {
      type: this.type,
      version: Number(this.version),
      occurredAt: new Date(this.occurredAt),
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      data,
      metadata: this.metadata,
    };
  }
}
