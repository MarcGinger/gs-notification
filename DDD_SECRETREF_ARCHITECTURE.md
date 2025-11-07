# DDD-Compliant SecretRef Architecture

## Overview

This document outlines the correct Domain-Driven Design (DDD) architecture for handling encrypted secrets in the SecureTest context. The architecture maintains clean separation of concerns while providing transparent encryption/decryption.

## Architecture Principles

### 🧠 Domain Layer

**Knows:** Business rules, invariants, aggregates, entities, and value objects  
**Does NOT know:** Persistence format, encryption, transport, or infrastructure details  
**Works with:** Pure business values (plaintext strings) as meaningful domain types  
**Contracts:** Repositories and services expressed in domain terms

```typescript
// ✅ Domain events with pure business values
interface SecureTestCreatedEventPayload {
  id: string;
  name: string;
  signingSecret?: string; // Pure business value, not encryption artifact
  username?: string; // Pure business value
  password?: string; // Pure business value
}
```

### ⚙️ Application Layer

**Coordinates:** Commands and queries between domain and infrastructure  
**Responsibilities:**

- Pass decrypted domain objects into aggregates
- Receive domain results and coordinate with encryption services
- Define which infrastructure adapters to use

```typescript
// ✅ Application service coordinates encryption without domain knowing
@Injectable()
export class SecureTestSecretRefService {
  createSecureTest(
    request: CreateSecureTestProps, // Plaintext from user
    context: ActorContext,
  ): Result<SecureTestProps, DomainError> {
    // Convert plaintext to SecretRef wrappers for infrastructure
    const secureProps: SecureTestProps = {
      signingSecretRef: request.signingSecret
        ? this.createSigningSecretRef(request, context)
        : undefined,
    };
    return ok(secureProps);
  }
}
```

### 🏗️ Infrastructure Layer

**Implements:** Mechanics of encryption, storage, and transport  
**Responsibilities:**

- Use appropriate encryption provider (Doppler, Sealed, etc.)
- Handle encryption at rest and decryption on read transparently
- Guarantee repositories never leak plaintext secrets

```typescript
// ✅ Infrastructure adapter handles encryption transparently
@Injectable()
export class EncryptedSecureTestWriterRepository implements ISecureTestWriter {
  constructor(
    private readonly inner: SecureTestWriterRepository,
    private readonly crypto: CryptoAdapter,
  ) {}

  async save(
    actor: ActorContext,
    secureTest: SecureTestAggregate,
  ): Promise<Result<SaveReceipt, DomainError>> {
    // Intercept domain events and encrypt sensitive fields before persistence
    const encryptedAggregate = this.encryptSensitiveFields(secureTest, actor);
    return this.inner.save(actor, encryptedAggregate);
  }
}
```

## Implementation Strategy

### Event Flow

1. **Domain Creates Events** with plaintext business values:

   ```typescript
   // Domain aggregate creates event with pure business data
   const createdEvent = SecureTestCreatedEvent.create({
     id: 'test-id',
     signingSecret: 'ACTUAL_SECRET_VALUE', // Pure business value
     username: 'admin', // Pure business value
   });
   ```

2. **Infrastructure Intercepts Events** before persistence:

   ```typescript
   // Infrastructure adapter encrypts before storage
   private encryptEventData(event: DomainEvent, actor: ActorContext): DomainEvent {
     const encryptedData = { ...event.data };

     if (event.data.signingSecret) {
       encryptedData.signingSecret = this.createSecretRef(
         event.data.signingSecret, // Take plaintext from domain
         actor.tenant,
         'signing',
       );
     }

     return { ...event, data: encryptedData };
   }
   ```

3. **EventStore Receives Encrypted Data**:
   ```json
   {
     "signingSecret": {
       "type": "doppler",
       "tenant": "core",
       "namespace": "signing",
       "key": "ENCRYPTED_REFERENCE_KEY"
     }
   }
   ```

### Repository Pattern

```typescript
// Application layer wires up the encryption adapter
@Module({
  providers: [
    SecureTestWriterRepository, // Inner repository
    {
      provide: ISecureTestWriter, // Interface
      useClass: EncryptedSecureTestWriterRepository, // Encryption adapter
    },
  ],
})
export class SecureTestModule {}
```

## Benefits

### ✅ Clean Domain Layer

- Domain works with pure business concepts
- No infrastructure leakage
- Easy to unit test with plain values
- Clear business logic

### ✅ Transparent Infrastructure

- Encryption/decryption happens automatically
- Multiple encryption providers supported
- Infrastructure changes don't affect domain
- Security handled at proper layer

### ✅ Flexible Application Layer

- Coordinates between layers appropriately
- Can switch encryption strategies
- Handles cross-cutting concerns
- Clear separation of responsibilities

## File Structure

```
secure-test/
├── domain/
│   ├── aggregates/
│   │   └── secure-test.aggregate.ts        # Works with plaintext
│   ├── events/
│   │   ├── secure-test-created.event.ts    # Pure business values
│   │   └── secure-test-updated.event.ts    # Pure business values
│   └── value-objects/
├── application/
│   ├── services/
│   │   └── secure-test-secretref.service.ts # Coordinates encryption
│   └── ports/                               # Domain interfaces
└── infrastructure/
    └── repositories/
        ├── secure-test-kurrentdb-writer.repository.ts     # Raw persistence
        ├── encrypted-secure-test-writer.repository.ts     # Encryption adapter
        └── encrypted-secure-test-reader.repository.ts     # Decryption adapter
```

## Migration Path

1. ✅ **Domain Events Fixed** - Now use plaintext business values
2. ✅ **Infrastructure Adapters Created** - Handle encryption transparently
3. 🔄 **Application Layer Updated** - Wire encryption adapters
4. 🔄 **Integration Tests** - Verify end-to-end encryption flow
5. 🔄 **Production Deployment** - Gradual rollout with monitoring

## Key Takeaways

- **Domain Layer**: Pure business values only (strings, numbers, etc.)
- **Application Layer**: Coordinates encryption without domain knowing
- **Infrastructure Layer**: Handles all encryption/decryption transparently
- **Events Store**: Encrypted data, but domain doesn't know or care
- **Testing**: Domain can be tested with plain values easily

This architecture ensures that encryption is handled at the proper layer while keeping the domain pure and focused on business logic.
