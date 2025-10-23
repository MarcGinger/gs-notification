// Generic PII Classification Service - GDPR/HIPAA compliant data classification
// Can be used across all domains for automatic PII detection and compliance

import { Injectable, Inject } from '@nestjs/common';
import {
  PIIPolicyProvider,
  PIIPolicyBundle,
  PII_POLICY_PROVIDER,
} from './pii-policy';
import { pathMatches } from './simple-glob';

/**
 * Categories of Personally Identifiable Information (PII)
 */
export enum PIICategory {
  PERSONAL_IDENTIFIER = 'personal_identifier', // Names, IDs, SSN
  CONTACT_INFO = 'contact_info', // Email, phone, address
  FINANCIAL = 'financial', // Account numbers, credit cards, financial data
  HEALTH = 'health', // Medical records, health information
  SENSITIVE = 'sensitive', // Race, religion, political views, biometric data
}

/**
 * Match Detail for precise PII detection
 */
export interface MatchDetail {
  path: string;
  fieldName: string;
  value: string;
  categories: PIICategory[];
  detector: string;
  confidence: number;
}

/**
 * Data Classification Result
 */
export interface DataClassification {
  containsPII: boolean;
  sensitiveFields: string[];
  piiCategories: PIICategory[];
  confidentialityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  requiresEncryption: boolean;
  gdprApplicable: boolean;
  hipaaApplicable: boolean;
  popiaApplicable: boolean;
  riskScore: number;
  matches: MatchDetail[];
}

/**
 * Generic PII compliance service for all domains
 *
 * Features:
 * - Pattern-based PII detection across all data types
 * - GDPR and HIPAA classification
 * - Configurable detection rules per domain
 * - Banking, healthcare, and general business patterns
 * - Audit trail generation for compliance
 */
@Injectable()
export class PIIClassificationService {
  constructor(
    @Inject(PII_POLICY_PROVIDER)
    private readonly policyProvider: PIIPolicyProvider,
  ) {}
  // Stateless PII detection patterns (no 'g' flag for stateless operation)
  private readonly patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i,
    phoneE164: /^\+?[1-9]\d{7,14}$/,
    phoneUS: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/,
    ipv4: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/,
    ipv6: /\b(?:[A-F0-9]{1,4}:){1,7}[A-F0-9]{1,4}\b/i,
    ssnUS: /\b\d{3}-?\d{2}-?\d{4}\b/,
    creditCandidate: /\b(?:\d[ -]?){13,19}\b/,
    bankAccount: /\b\d{8,17}\b/,
    zipCodeUS: /\b\d{5}(-\d{4})?\b/,
    medicalId: /\b(MRN|MR|PATIENT)\s*[:#]?\s*\d+\b/i,
    drivingLicense: /\b[A-Z]{1,3}\d{6,10}\b/,
    passport: /\b[A-Z]\d{8}\b/,
  } as const;

  // Truly universal PII keywords only - no domain-specific assumptions
  private readonly baseKeywords = [
    'email',
    'phone',
    'mobile',
    'address',
    'street',
    'city',
    'postal',
    'contact',
    'iban',
    'swift',
    'card',
    'credit',
    'debit',
    'bank',
    'salary',
    'tax',
    'payment',
    'medical',
    'health',
    'diagnosis',
    'treatment',
    'patient',
    'race',
    'ethnicity',
    'religion',
    'political',
    'biometric',
    'fingerprint',
  ];

  /**
   * Resolve path-aware rule for a given field path
   */
  private resolveRule(
    path: string,
    policy: PIIPolicyBundle,
  ): { action: 'pii' | 'nonpii'; category?: string } | null {
    if (!policy.rules) return null;

    for (const rule of policy.rules) {
      if (pathMatches(path, rule.match)) {
        return rule as { action: 'pii' | 'nonpii'; category?: string };
      }
    }
    return null;
  }

  /**
   * Map string category to PIICategory enum
   */
  private mapCategoryToEnum(category: string): PIICategory {
    switch (category) {
      case 'personal_identifier':
        return PIICategory.PERSONAL_IDENTIFIER;
      case 'contact_info':
        return PIICategory.CONTACT_INFO;
      case 'financial':
        return PIICategory.FINANCIAL;
      case 'health':
        return PIICategory.HEALTH;
      case 'sensitive':
        return PIICategory.SENSITIVE;
      default:
        return PIICategory.PERSONAL_IDENTIFIER;
    }
  }

  /**
   * Classify any data object for PII content with domain-aware policy
   */
  classifyData<T extends Record<string, unknown>>(
    data: T,
    ctx: { domain: string; tenantId?: string },
  ): DataClassification {
    // Get domain/tenant-specific policy
    const policy = this.policyProvider.getPolicy(ctx);
    const matches: MatchDetail[] = [];

    // Recursively traverse the data structure with policy
    this.visit(data, '', matches, policy);

    const sensitiveFields = [...new Set(matches.map((m) => m.fieldName))];
    const piiCategories = [...new Set(matches.flatMap((m) => m.categories))];
    const containsPII = matches.length > 0;

    // Calculate risk score
    const riskScore = this.calculateRiskScore(matches);

    // Determine confidentiality level
    const confidentialityLevel =
      this.determineConfidentialityLevel(piiCategories);

    // Enhanced HIPAA detection: HEALTH + (CONTACT_INFO or PERSONAL_IDENTIFIER)
    const hipaaApplicable =
      piiCategories.includes(PIICategory.HEALTH) &&
      (piiCategories.includes(PIICategory.CONTACT_INFO) ||
        piiCategories.includes(PIICategory.PERSONAL_IDENTIFIER));

    // POPIA applicable for any PII (configurable by tenant policy)
    const popiaApplicable = containsPII;

    return {
      containsPII,
      sensitiveFields,
      piiCategories,
      confidentialityLevel,
      requiresEncryption: this.requiresEncryption(piiCategories),
      gdprApplicable: this.isGDPRApplicable(piiCategories),
      hipaaApplicable,
      popiaApplicable,
      riskScore,
      matches,
    };
  }

  /**
   * Recursively visit all nodes in the data structure with policy context
   */
  private visit(
    node: unknown,
    path: string,
    matches: MatchDetail[],
    policy: PIIPolicyBundle,
  ): void {
    if (node == null) return;

    if (Array.isArray(node)) {
      node.forEach((value, index) =>
        this.visit(value, `${path}[${index}]`, matches, policy),
      );
      return;
    }

    if (typeof node === 'object') {
      Object.entries(node as Record<string, unknown>).forEach(
        ([key, value]) => {
          const newPath = path ? `${path}.${key}` : key;
          this.inspectLeaf(key, value, newPath, matches, policy);
          this.visit(value, newPath, matches, policy);
        },
      );
      return;
    }

    // Handle primitive values at the root level
    const fieldName = path.split('.').pop() || path;
    this.inspectLeaf(fieldName, node, path, matches, policy);
  }

  /**
   * Inspect a leaf value for PII patterns with policy context
   */
  private inspectLeaf(
    fieldName: string,
    value: unknown,
    path: string,
    matches: MatchDetail[],
    policy: PIIPolicyBundle,
  ): void {
    if (typeof value !== 'string' || !value.trim()) {
      return;
    }

    const stringValue = value.toString();
    const lowerFieldName = fieldName.toLowerCase();

    // Apply policy-based field classification with clear precedence rules:
    // 1. Path-aware rules (highest precedence) → 2. fieldHints → 3. regex/heuristics → 4. keywords

    // 1. Check path-aware rules first (NEW: highest precedence)
    const rule = this.resolveRule(path, policy);
    if (rule?.action === 'nonpii') {
      return; // Explicitly not PII, skip all further checks
    }

    if (rule?.action === 'pii') {
      // Path rule matches, add as PII with specified category
      const category = this.mapCategoryToEnum(
        rule.category || 'personal_identifier',
      );
      matches.push({
        path,
        fieldName,
        value: stringValue,
        categories: [category],
        detector: 'path_rule',
        confidence: 1.0, // Highest confidence for explicit rules
      });
      return;
    }

    // 2. Check explicit field hints (legacy support)
    let fieldNameSensitive = false;
    if (policy.fieldHints?.piiFields?.includes(path)) {
      fieldNameSensitive = true;
    } else if (policy.fieldHints?.nonPiiFields?.includes(path)) {
      fieldNameSensitive = false; // Explicitly not PII, skip keyword check
    } else {
      // 3. Check field name against policy keywords (merged baseline + domain)
      fieldNameSensitive = policy.keywords.include.some((keyword: string) =>
        lowerFieldName.includes(keyword.toLowerCase()),
      );
    }

    // Check value content against PII patterns
    const patternMatches = this.detectPatternsInValue(stringValue);

    if (fieldNameSensitive || patternMatches.length > 0) {
      const categories = this.categorizePII(fieldName, stringValue);

      if (categories.length > 0) {
        matches.push({
          path,
          fieldName,
          value: stringValue,
          categories,
          detector: fieldNameSensitive ? 'field_name' : 'pattern',
          confidence: this.calculateConfidence(
            fieldNameSensitive,
            patternMatches,
          ),
        });
      }
    }
  }

  /**
   * Detect PII patterns in a value
   */
  private detectPatternsInValue(content: string): string[] {
    const detectedPatterns: string[] = [];

    Object.entries(this.patterns).forEach(([patternName, pattern]) => {
      if (pattern.test(content)) {
        // Special validation for credit card candidates
        if (patternName === 'creditCandidate') {
          const digits = content.replace(/\D/g, '');
          if (this.passesLuhn(digits)) {
            detectedPatterns.push('creditCard');
          }
        } else {
          detectedPatterns.push(patternName);
        }
      }
    });

    return detectedPatterns;
  }

  /**
   * Luhn algorithm for credit card validation
   */
  private passesLuhn(cardNumber: string): boolean {
    if (!/^\d{13,19}$/.test(cardNumber)) return false;

    let sum = 0;
    let alternate = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let digit = parseInt(cardNumber.charAt(i), 10);

      if (alternate) {
        digit *= 2;
        if (digit > 9) {
          digit = Math.floor(digit / 10) + (digit % 10);
        }
      }

      sum += digit;
      alternate = !alternate;
    }

    return sum % 10 === 0;
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(
    fieldNameMatch: boolean,
    patternMatches: string[],
  ): number {
    let confidence = 0;

    if (fieldNameMatch) confidence += 0.6;
    if (patternMatches.length > 0) confidence += 0.7;
    if (fieldNameMatch && patternMatches.length > 0) confidence = 0.95;

    return Math.min(confidence, 1.0);
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(matches: MatchDetail[]): number {
    if (matches.length === 0) return 0;

    const categoryWeights = {
      [PIICategory.SENSITIVE]: 1.0,
      [PIICategory.HEALTH]: 0.9,
      [PIICategory.FINANCIAL]: 0.8,
      [PIICategory.PERSONAL_IDENTIFIER]: 0.6,
      [PIICategory.CONTACT_INFO]: 0.4,
    };

    const maxCategoryScore = Math.max(
      ...matches.flatMap((m) =>
        m.categories.map((cat) => categoryWeights[cat] || 0),
      ),
    );

    const volumeMultiplier = Math.min(matches.length / 10, 1.0);
    const avgConfidence =
      matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length;

    return Math.min(
      maxCategoryScore * (0.7 + volumeMultiplier * 0.3) * avgConfidence,
      1.0,
    );
  }

  /**
   * Categorize the type of PII found
   */
  private categorizePII(fieldName: string, value: string): PIICategory[] {
    const categories: PIICategory[] = [];
    const lowerFieldName = fieldName.toLowerCase();

    // Personal identifiers
    if (
      ['name', 'firstname', 'lastname', 'ssn', 'id', 'passport'].some((term) =>
        lowerFieldName.includes(term),
      ) ||
      this.patterns.ssnUS.test(value) ||
      this.patterns.passport.test(value)
    ) {
      categories.push(PIICategory.PERSONAL_IDENTIFIER);
    }

    // Contact information
    if (
      ['email', 'phone', 'address', 'contact'].some((term) =>
        lowerFieldName.includes(term),
      ) ||
      this.patterns.email.test(value) ||
      this.patterns.phoneUS.test(value) ||
      this.patterns.phoneE164.test(value)
    ) {
      categories.push(PIICategory.CONTACT_INFO);
    }

    // Financial information
    if (
      ['account', 'card', 'bank', 'financial', 'payment', 'salary'].some(
        (term) => lowerFieldName.includes(term),
      ) ||
      this.patterns.bankAccount.test(value) ||
      (this.patterns.creditCandidate.test(value) &&
        this.passesLuhn(value.replace(/\D/g, '')))
    ) {
      categories.push(PIICategory.FINANCIAL);
    }

    // Health information
    if (
      ['medical', 'health', 'patient', 'diagnosis', 'treatment'].some((term) =>
        lowerFieldName.includes(term),
      ) ||
      this.patterns.medicalId.test(value)
    ) {
      categories.push(PIICategory.HEALTH);
    }

    // Sensitive personal data
    if (
      ['race', 'religion', 'political', 'sexual', 'biometric'].some((term) =>
        lowerFieldName.includes(term),
      )
    ) {
      categories.push(PIICategory.SENSITIVE);
    }

    return categories;
  }

  /**
   * Determine confidentiality level based on PII categories
   */
  private determineConfidentialityLevel(
    categories: PIICategory[],
  ): 'public' | 'internal' | 'confidential' | 'restricted' {
    if (
      categories.includes(PIICategory.HEALTH) ||
      categories.includes(PIICategory.SENSITIVE)
    ) {
      return 'restricted';
    }

    if (categories.includes(PIICategory.FINANCIAL)) {
      return 'confidential';
    }

    if (
      categories.includes(PIICategory.PERSONAL_IDENTIFIER) ||
      categories.includes(PIICategory.CONTACT_INFO)
    ) {
      return 'internal';
    }

    return 'public';
  }

  /**
   * Check if data requires encryption
   */
  private requiresEncryption(categories: PIICategory[]): boolean {
    return categories.some((cat) =>
      [
        PIICategory.FINANCIAL,
        PIICategory.HEALTH,
        PIICategory.SENSITIVE,
      ].includes(cat),
    );
  }

  /**
   * Check if GDPR applies to this data
   */
  private isGDPRApplicable(categories: PIICategory[]): boolean {
    // GDPR applies to any personal data
    return categories.length > 0;
  }

  /**
   * Check if HIPAA applies to this data
   */
  private isHIPAAApplicable(categories: PIICategory[]): boolean {
    return categories.includes(PIICategory.HEALTH);
  }

  /**
   * Generate compliance metadata for audit purposes
   */
  generateComplianceMetadata(
    classification: DataClassification,
    context: {
      domain: string;
      entityType: string;
      operation: string;
      userId: string;
      tenantId: string;
    },
  ) {
    return {
      timestamp: new Date().toISOString(),
      domain: context.domain,
      entityType: context.entityType,
      operation: context.operation,
      userId: context.userId,
      tenantId: context.tenantId,
      classification: {
        containsPII: classification.containsPII,
        sensitiveFields: classification.sensitiveFields,
        piiCategories: classification.piiCategories,
        confidentialityLevel: classification.confidentialityLevel,
        requiresEncryption: classification.requiresEncryption,
        gdprApplicable: classification.gdprApplicable,
        hipaaApplicable: classification.hipaaApplicable,
      },
      complianceRequirements: {
        encryptionRequired: classification.requiresEncryption,
        auditTrailRequired: true,
        retentionPolicyRequired: classification.containsPII,
        consentRequired: classification.piiCategories.includes(
          PIICategory.SENSITIVE,
        ),
      },
    };
  }
}
