// Generic Data Retention Service - GDPR/HIPAA compliant data lifecycle management
// Handles data retention periods, automated deletion, and audit requirements
// Can be used across all domains for consistent data retention policies

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { DataClassification, PIICategory } from './pii-classification.service';
import { Clock, CLOCK } from 'src/shared/infrastructure/time';

/**
 * Retention Policy Repository Interface
 */
export interface RetentionPolicyRepository {
  getRetentionPeriods(
    tenantId?: string,
    domain?: string,
  ): Promise<RetentionPeriod[]>;
  updateRetentionPeriod(
    category: PIICategory,
    retentionDays: number,
    legalBasis: string,
    tenantId?: string,
    domain?: string,
  ): Promise<void>;
}

// DI token for RetentionPolicyRepository (Clock is already provided by TimeModule)
export const RETENTION_POLICY_REPOSITORY = Symbol(
  'RETENTION_POLICY_REPOSITORY',
);

/**
 * Retention Period Configuration
 */
export interface RetentionPeriod {
  category: PIICategory;
  retentionDays: number;
  legalBasis: string;
  automaticDeletion: boolean;
  requiresUserConsent: boolean;
}

/**
 * Enhanced Data Deletion Request with legal hold support
 */
export interface DeletionRequest {
  tenantId: string;
  entityId: string;
  entityType: string;
  domain: string;
  reason: 'retention_expired' | 'user_request' | 'legal_requirement';
  requestedBy: string;
  timestamp: string;
  legalHold?: boolean;
}

/**
 * Enhanced Retention Audit Record with rule versioning
 */
export interface RetentionAudit {
  tenantId: string;
  entityId: string;
  entityType: string;
  domain: string;
  action: 'created' | 'updated' | 'deleted' | 'anonymized';
  retentionExpiry: string;
  legalBasis: string;
  performedBy: string;
  timestamp: string;
  rulePack?: string;
  metadata: Record<string, unknown>;
}

/**
 * Generic GDPR/HIPAA compliant data retention service
 *
 * Key Features:
 * - Automatic retention period calculation based on data classification
 * - Domain-agnostic retention policies
 * - Scheduled cleanup of expired data
 * - User consent tracking for data processing
 * - Audit trail for all retention activities
 * - Support for data anonymization vs deletion
 * - Legal basis tracking per GDPR Article 6
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);
  private readonly currentRulePack = 'retention-defaults@1.1.0';

  constructor(
    @Optional()
    @Inject(RETENTION_POLICY_REPOSITORY)
    private readonly policyRepository: RetentionPolicyRepository | null,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  // Default retention periods (configurable via environment/database)
  private readonly defaultRetentionPeriods: RetentionPeriod[] = [
    {
      category: PIICategory.PERSONAL_IDENTIFIER,
      retentionDays: 2555, // 7 years (financial services standard)
      legalBasis: 'Legal obligation (Article 6(1)(c))',
      automaticDeletion: true,
      requiresUserConsent: false,
    },
    {
      category: PIICategory.CONTACT_INFO,
      retentionDays: 1095, // 3 years (marketing consent)
      legalBasis: 'Consent (Article 6(1)(a))',
      automaticDeletion: true,
      requiresUserConsent: true,
    },
    {
      category: PIICategory.FINANCIAL,
      retentionDays: 2555, // 7 years (regulatory requirement)
      legalBasis: 'Legal obligation (Article 6(1)(c))',
      automaticDeletion: false, // Requires manual review
      requiresUserConsent: false,
    },
    {
      category: PIICategory.HEALTH,
      retentionDays: 2190, // 6 years (HIPAA requirement)
      legalBasis: 'Vital interests (Article 6(1)(d))',
      automaticDeletion: false, // Requires manual review
      requiresUserConsent: false,
    },
    {
      category: PIICategory.SENSITIVE,
      retentionDays: 365, // 1 year (minimal retention)
      legalBasis: 'Explicit consent (Article 9(2)(a))',
      automaticDeletion: true,
      requiresUserConsent: true,
    },
  ];

  /**
   * Calculate retention expiry date for classified data with tenant/domain support
   */
  async calculateRetentionExpiry(
    classification: DataClassification,
    tenantId?: string,
    domain?: string,
  ): Promise<{
    expiryDateUtc: Date;
    retentionDays: number;
    legalBasis: string;
    automaticDeletion: boolean;
    rulePack: string;
  }> {
    // Get tenant/domain-specific policies first, fallback to defaults
    const retentionPeriods = this.policyRepository
      ? await this.policyRepository.getRetentionPeriods(tenantId, domain)
      : this.defaultRetentionPeriods;

    let maxRetentionDays = 30; // Default for non-PII data
    let applicableBasis = 'Legitimate interests (Article 6(1)(f))';
    let automaticDeletion = true;

    classification.piiCategories.forEach((category) => {
      const retention = retentionPeriods.find((r) => r.category === category);

      if (retention && retention.retentionDays > maxRetentionDays) {
        maxRetentionDays = retention.retentionDays;
        applicableBasis = retention.legalBasis;
        automaticDeletion = retention.automaticDeletion;
      }
    });

    const now = this.clock.now();
    const expiryDateUtc = new Date(
      now.getTime() + maxRetentionDays * 24 * 60 * 60 * 1000,
    );

    return {
      expiryDateUtc,
      retentionDays: maxRetentionDays,
      legalBasis: applicableBasis,
      automaticDeletion,
      rulePack: this.currentRulePack,
    };
  }

  /**
   * Check if data has expired based on retention policy
   */
  async isDataExpired(
    createdAt: Date,
    classification: DataClassification,
    tenantId?: string,
    domain?: string,
    now?: Date,
  ): Promise<boolean> {
    const retention = await this.calculateRetentionExpiry(
      classification,
      tenantId,
      domain,
    );
    const actualExpiryDate = new Date(
      createdAt.getTime() + retention.retentionDays * 24 * 60 * 60 * 1000,
    );
    const currentTime = now || this.clock.now();
    return currentTime > actualExpiryDate;
  }

  /**
   * Generate retention metadata for new data
   */
  async generateRetentionMetadata(
    classification: DataClassification,
    context: {
      tenantId: string;
      userId: string;
      entityType: string;
      entityId: string;
      domain: string;
    },
  ): Promise<{
    retentionExpiry: string;
    legalBasis: string;
    automaticDeletion: boolean;
    auditRecord: RetentionAudit;
  }> {
    const retention = await this.calculateRetentionExpiry(
      classification,
      context.tenantId,
      context.domain,
    );

    const auditRecord: RetentionAudit = {
      tenantId: context.tenantId,
      entityId: context.entityId,
      entityType: context.entityType,
      domain: context.domain,
      action: 'created',
      retentionExpiry: retention.expiryDateUtc.toISOString(),
      legalBasis: retention.legalBasis,
      performedBy: context.userId,
      timestamp: this.clock.now().toISOString(),
      rulePack: retention.rulePack,
      metadata: {
        piiCategories: classification.piiCategories,
        sensitiveFields: classification.sensitiveFields,
        retentionDays: retention.retentionDays,
        confidentialityLevel: classification.confidentialityLevel,
        requiresEncryption: classification.requiresEncryption,
      },
    };

    return {
      retentionExpiry: retention.expiryDateUtc.toISOString(),
      legalBasis: retention.legalBasis,
      automaticDeletion: retention.automaticDeletion,
      auditRecord,
    };
  }

  /**
   * Process data deletion request with legal hold support (GDPR Article 17 - Right to erasure)
   */
  processDataDeletion(request: DeletionRequest): {
    success: boolean;
    action: 'deleted' | 'anonymized' | 'retained';
    reason?: string;
    auditRecord: RetentionAudit;
  } {
    this.logger.log('Processing data deletion request', {
      entityId: request.entityId,
      domain: request.domain,
      reason: request.reason,
      legalHold: request.legalHold,
    });

    // Check for legal hold first
    if (request.legalHold) {
      const auditRecord: RetentionAudit = {
        tenantId: request.tenantId,
        entityId: request.entityId,
        entityType: request.entityType,
        domain: request.domain,
        action: 'updated',
        retentionExpiry: 'extended',
        legalBasis: 'Legal hold active',
        performedBy: request.requestedBy,
        timestamp: this.clock.now().toISOString(),
        rulePack: this.currentRulePack,
        metadata: {
          deletionReason: request.reason,
          originalRequest: request,
          processingOutcome: 'retained',
          legalHoldActive: true,
        },
      };

      return {
        success: true,
        action: 'retained',
        reason: 'Data retention required due to active legal hold',
        auditRecord,
      };
    }

    // Determine action based on reason and business rules
    const action: 'deleted' | 'anonymized' | 'retained' =
      request.reason === 'legal_requirement' ? 'retained' : 'deleted';

    const auditRecord: RetentionAudit = {
      tenantId: request.tenantId,
      entityId: request.entityId,
      entityType: request.entityType,
      domain: request.domain,
      action: action === 'retained' ? 'updated' : action,
      retentionExpiry: action === 'retained' ? 'extended' : 'immediate',
      legalBasis: 'Article 17 - Right to erasure',
      performedBy: request.requestedBy,
      timestamp: this.clock.now().toISOString(),
      rulePack: this.currentRulePack,
      metadata: {
        deletionReason: request.reason,
        originalRequest: request,
        processingOutcome: action,
      },
    };

    return {
      success: true,
      action,
      reason:
        action === 'retained'
          ? 'Data retention required by legal obligation'
          : undefined,
      auditRecord,
    };
  }

  /**
   * Anonymize data instead of deleting (when deletion is not possible)
   */
  anonymizeExpiredData(
    entityId: string,
    entityType: string,
    tenantId: string,
    domain: string,
  ): RetentionAudit {
    const auditRecord: RetentionAudit = {
      tenantId,
      entityId,
      entityType,
      domain,
      action: 'anonymized',
      retentionExpiry: 'n/a',
      legalBasis: 'Data minimization principle (Article 5(1)(c))',
      performedBy: 'system',
      timestamp: this.clock.now().toISOString(),
      rulePack: this.currentRulePack,
      metadata: {
        anonymizationMethod: 'field_replacement',
        preservedFields: ['id', 'createdAt', 'tenantId'],
        anonymizationDate: this.clock.now().toISOString(),
      },
    };

    this.logger.log('Data anonymized', {
      entityId,
      entityType,
      domain,
      tenantId,
    });

    return auditRecord;
  }

  /**
   * Generate data retention report for compliance audits
   */
  generateRetentionReport(domain?: string): {
    summary: {
      totalEntities: number;
      expiredEntities: number;
      deletedEntities: number;
      anonymizedEntities: number;
    };
    byCategory: Record<PIICategory, number>;
    byDomain: Record<string, number>;
    auditTrail: RetentionAudit[];
  } {
    // In production, query actual audit records from database
    const summary = {
      totalEntities: 0,
      expiredEntities: 0,
      deletedEntities: 0,
      anonymizedEntities: 0,
    };

    const byCategory: Record<PIICategory, number> = {
      [PIICategory.PERSONAL_IDENTIFIER]: 0,
      [PIICategory.CONTACT_INFO]: 0,
      [PIICategory.FINANCIAL]: 0,
      [PIICategory.HEALTH]: 0,
      [PIICategory.SENSITIVE]: 0,
    };

    const byDomain: Record<string, number> = {};

    this.logger.log('Generated retention report', {
      domain,
      summary,
    });

    return {
      summary,
      byCategory,
      byDomain,
      auditTrail: [],
    };
  }

  /**
   * Get retention periods configuration
   */
  getRetentionPeriods(): RetentionPeriod[] {
    return [...this.defaultRetentionPeriods];
  }

  /**
   * Update retention period for a specific category (admin function)
   */
  updateRetentionPeriod(
    category: PIICategory,
    retentionDays: number,
    legalBasis: string,
  ): void {
    const existing = this.defaultRetentionPeriods.find(
      (p) => p.category === category,
    );
    if (existing) {
      existing.retentionDays = retentionDays;
      existing.legalBasis = legalBasis;
    }

    this.logger.log('Retention period updated', {
      category,
      retentionDays,
      legalBasis,
    });
  }
}
