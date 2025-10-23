import { Module } from '@nestjs/common';
import { TimeModule } from 'src/shared/infrastructure/time';
import { PIIClassificationService } from './pii-classification.service';
import {
  PIIProtectionService,
  EnvironmentKeyProvider,
  KEY_PROVIDER,
} from './pii-protection.service';
import { DataRetentionService } from './data-retention.service';
import { DefaultPIIPolicyProvider } from './policy.provider';
import { PII_POLICY_PROVIDER } from './pii-policy';

/**
 * Compliance Module - Provides PII classification, protection, and data retention services
 * Configures all necessary dependencies for GDPR/HIPAA compliance across the application
 */
@Module({
  imports: [
    TimeModule, // Required for Clock interface in DataRetentionService
  ],
  providers: [
    // Key Provider for PII Protection
    {
      provide: KEY_PROVIDER,
      useClass: EnvironmentKeyProvider,
    },

    // PII Policy Provider binding
    {
      provide: PII_POLICY_PROVIDER,
      useClass: DefaultPIIPolicyProvider,
    },

    // Core compliance services
    PIIClassificationService,
    PIIProtectionService,
    DataRetentionService,
  ],
  exports: [
    PIIClassificationService,
    PIIProtectionService,
    DataRetentionService,
    KEY_PROVIDER, // Export for potential custom implementations
    PII_POLICY_PROVIDER, // Export for potential custom implementations
  ],
})
export class ComplianceModule {}
