import { Module } from '@nestjs/common';
import { AesGcmFieldEncryptionService } from './aes-gcm-field-encryption.service';
import { InMemoryKeyProvider } from './in-memory-key-provider';

/**
 * Encryption Module
 *
 * Provides field-level encryption services for PII protection
 * at the persistence boundary (writer repositories).
 *
 * @pattern Dependency Injection for Encryption Services
 * @layer Infrastructure - Encryption Module
 */

// DI Tokens for encryption services
export const FIELD_ENCRYPTION_SERVICE = Symbol('FIELD_ENCRYPTION_SERVICE');
export const KEY_PROVIDER = Symbol('KEY_PROVIDER');

@Module({
  providers: [
    InMemoryKeyProvider,
    AesGcmFieldEncryptionService,
    {
      provide: FIELD_ENCRYPTION_SERVICE,
      useClass: AesGcmFieldEncryptionService,
    },
  ],
  exports: [
    FIELD_ENCRYPTION_SERVICE,
    InMemoryKeyProvider,
    AesGcmFieldEncryptionService,
  ],
})
export class EncryptionModule {}

/**
 * Export types and interfaces for use in other modules
 */
export * from './types';
export { AesGcmFieldEncryptionService } from './aes-gcm-field-encryption.service';
export { InMemoryKeyProvider } from './in-memory-key-provider';
