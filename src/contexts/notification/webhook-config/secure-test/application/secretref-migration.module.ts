/**
 * SecretRef Migration Module
 *
 * This module provides the NestJS dependency injection setup for the
 * SecretRef migration services, enabling gradual rollout of SecretRef
 * functionality while maintaining backward compatibility.
 */

import { Module } from '@nestjs/common';
import { SecureTestSecretMappingService } from './services/secure-test-secret-mapping.service';
import { SecureTestHybridService } from './services/secure-test-hybrid.service';

/**
 * SecretRefMigrationModule
 *
 * Provides:
 * - SecureTestSecretMappingService: Handles CreateProps→SecureProps mapping
 * - SecureTestHybridService: Intelligent routing with fallback mechanisms
 *
 * This module can be imported by the main SecureTestModule to enable
 * SecretRef functionality alongside existing legacy implementations.
 */
@Module({
  providers: [SecureTestSecretMappingService, SecureTestHybridService],
  exports: [
    // Export hybrid service as the primary interface for consumers
    SecureTestHybridService,
    // Export mapping service for direct use if needed
    SecureTestSecretMappingService,
  ],
})
export class SecretRefMigrationModule {}
