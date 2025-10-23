import { Module } from '@nestjs/common';
import { ComplianceModule } from '../../services/compliance';
import { EncryptionModule } from '../encryption';
import { LoggingModule } from '../../logging';
import { PIIEncryptionAdapter } from './pii-encryption.adapter';

/**
 * Compliance Infrastructure Module
 *
 * Provides infrastructure adapters for compliance features,
 * bridging domain services with technical implementation.
 *
 * Features:
 * - PII encryption adapters
 * - Field-level encryption integration
 * - Compliance policy enforcement
 */
@Module({
  imports: [
    ComplianceModule, // Domain compliance services
    EncryptionModule, // Field encryption infrastructure
    LoggingModule, // For logger injection
  ],
  providers: [PIIEncryptionAdapter],
  exports: [PIIEncryptionAdapter],
})
export class ComplianceInfrastructureModule {}
