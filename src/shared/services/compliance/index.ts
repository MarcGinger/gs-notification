// Shared Compliance Services - Export all compliance utilities
// These services can be used across all domains for consistent GDPR/HIPAA compliance

export {
  PIIClassificationService,
  PIICategory,
  DataClassification,
  MatchDetail,
} from './pii-classification.service';
export {
  PIIProtectionService,
  ProtectionStrategy,
  ProtectionResult,
  KeyProvider,
  EnvironmentKeyProvider,
  KEY_PROVIDER,
} from './pii-protection.service';
export {
  DataRetentionService,
  RetentionPeriod,
  DeletionRequest,
  RetentionAudit,
  RetentionPolicyRepository,
  RETENTION_POLICY_REPOSITORY,
} from './data-retention.service';

// Re-export Clock from infrastructure for convenience
export { Clock } from 'src/shared/infrastructure/time';

// Export the compliance module for easy integration
export { ComplianceModule } from './compliance.module';

export { registerDomainPolicy } from './policy.provider';
export { PIIPolicyProvider, PIIPolicyBundle } from './pii-policy';
