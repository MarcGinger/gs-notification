// PII Policy Provider - Manages domain and tenant-specific PII detection policies
// Provides runtime policy resolution with fallback to domain defaults

import { Injectable } from '@nestjs/common';
import { PIIPolicyProvider, PIIPolicyBundle } from './pii-policy';
import { DEFAULT_BASELINE } from '../../../policies/pii/default-policies';

// Registry for domain-specific policies (populated by domain modules)
const DOMAIN_POLICY_REGISTRY = new Map<string, PIIPolicyBundle>();

/**
 * Register a domain-specific PII policy
 * Called by domain modules during initialization
 */
export function registerDomainPolicy(policy: PIIPolicyBundle): void {
  DOMAIN_POLICY_REGISTRY.set(policy.domain, policy);
}

@Injectable()
export class DefaultPIIPolicyProvider implements PIIPolicyProvider {
  getPolicy({
    domain,
    tenantId,
  }: {
    domain: string;
    tenantId?: string;
  }): PIIPolicyBundle {
    const domainPolicy = DOMAIN_POLICY_REGISTRY.get(domain);

    if (!domainPolicy) {
      // Fallback to baseline only if no domain policy registered
      return {
        domain,
        tenantId,
        keywords: DEFAULT_BASELINE,
        fieldHints: undefined,
        rules: undefined, // No domain-specific rules available
        protection: undefined,
      };
    }

    // TODO: Add tenant-specific overrides from database/KV store
    // const tenantOverrides = await this.getTenantOverrides(tenantId, domain);

    // Merge baseline with domain-specific keywords
    const mergedInclude = [
      ...new Set([
        ...DEFAULT_BASELINE.include,
        ...(domainPolicy.keywords.include ?? []),
      ]),
    ];

    // Apply exclusions
    const effectiveKeywords = domainPolicy.keywords.exclude
      ? mergedInclude.filter(
          (keyword) => !domainPolicy.keywords.exclude!.includes(keyword),
        )
      : mergedInclude;

    return {
      domain,
      tenantId,
      keywords: {
        include: effectiveKeywords,
        exclude: domainPolicy.keywords.exclude,
      },
      fieldHints: domainPolicy.fieldHints,
      rules: domainPolicy.rules, // ADD: Include path-aware rules
      protection: domainPolicy.protection,
    };
  }

  // Future: Add tenant-specific policy loading
  // private async getTenantOverrides(tenantId?: string, domain?: string): Promise<Partial<PIIPolicyBundle>> {
  //   if (!tenantId) return {};
  //   // Load from database/KV store
  //   return {};
  // }
}
