import { TenantContext } from '../tenant';

/**
 * SecretRef Operation Events
 * Enhanced domain events that include tenant context for sealed SecretRef operations
 */

/**
 * Base interface for SecretRef domain events
 * All SecretRef-related events should extend this to ensure consistent tenant context
 */
export interface SecretRefDomainEvent {
  readonly eventType: string;
  readonly eventVersion: string;
  readonly tenantContext?: TenantContext;
  readonly occurredAt: Date;
}

/**
 * SecretRef Sealed Event Payload
 * Emitted when a secret is successfully sealed with tenant-specific encryption
 */
export interface SecretRefSealedEventPayload {
  /** The original field context (e.g., 'notification.slack.signingSecret') */
  readonly fieldContext: string;

  /** Algorithm used for sealing */
  readonly algorithm: string;

  /** KEK identifier used for encryption */
  readonly kekId: string;

  /** Size of the encrypted blob in bytes */
  readonly blobSize: number;

  /** Optional additional authenticated data */
  readonly aad?: string;
}

/**
 * SecretRef Sealed Domain Event
 * Triggered when a plaintext secret is successfully sealed using tenant KEK
 */
export class SecretRefSealedEvent implements SecretRefDomainEvent {
  public readonly eventType = 'SecretRefSealed.v1';
  public readonly eventVersion = 'v1';
  public readonly occurredAt = new Date();

  constructor(
    public readonly payload: SecretRefSealedEventPayload,
    public readonly tenantContext: TenantContext,
  ) {}

  static create(
    payload: SecretRefSealedEventPayload,
    tenantContext: TenantContext,
  ): SecretRefSealedEvent {
    return new SecretRefSealedEvent(payload, tenantContext);
  }
}

/**
 * SecretRef Unsealed Event Payload
 * Emitted when a sealed secret is successfully decrypted
 */
export interface SecretRefUnsealedEventPayload {
  /** The field context that was unsealed */
  readonly fieldContext: string;

  /** KEK identifier used for decryption */
  readonly kekId: string;

  /** Whether unsealing was successful */
  readonly success: boolean;

  /** Optional error message if unsealing failed */
  readonly error?: string;
}

/**
 * SecretRef Unsealed Domain Event
 * Triggered when a sealed secret is accessed and decrypted
 */
export class SecretRefUnsealedEvent implements SecretRefDomainEvent {
  public readonly eventType = 'SecretRefUnsealed.v1';
  public readonly eventVersion = 'v1';
  public readonly occurredAt = new Date();

  constructor(
    public readonly payload: SecretRefUnsealedEventPayload,
    public readonly tenantContext: TenantContext,
  ) {}

  static create(
    payload: SecretRefUnsealedEventPayload,
    tenantContext: TenantContext,
  ): SecretRefUnsealedEvent {
    return new SecretRefUnsealedEvent(payload, tenantContext);
  }
}

/**
 * KEK Rotation Event Payload
 * Emitted when a tenant's KEK is rotated for security purposes
 */
export interface KekRotationEventPayload {
  /** The old KEK identifier being replaced */
  readonly oldKekId: string;

  /** The new KEK identifier */
  readonly newKekId: string;

  /** Reason for rotation (scheduled, compromised, etc.) */
  readonly rotationReason: 'scheduled' | 'compromised' | 'manual';

  /** Number of secrets that need re-sealing with new KEK */
  readonly affectedSecretsCount: number;
}

/**
 * KEK Rotation Domain Event
 * Triggered when a tenant's Key Encryption Key is rotated
 */
export class KekRotationEvent implements SecretRefDomainEvent {
  public readonly eventType = 'KekRotation.v1';
  public readonly eventVersion = 'v1';
  public readonly occurredAt = new Date();

  constructor(
    public readonly payload: KekRotationEventPayload,
    public readonly tenantContext: TenantContext,
  ) {}

  static create(
    payload: KekRotationEventPayload,
    tenantContext: TenantContext,
  ): KekRotationEvent {
    return new KekRotationEvent(payload, tenantContext);
  }
}

/**
 * Union type for all SecretRef domain events
 */
export type SecretRefDomainEventUnion =
  | SecretRefSealedEvent
  | SecretRefUnsealedEvent
  | KekRotationEvent;
