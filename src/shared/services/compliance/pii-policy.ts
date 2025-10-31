// PII Policy Contracts - Domain and tenant-aware PII detection policies
// Enables domain-specific classification without shared service assumptions

export type PIIRule =
  | {
      match: string;
      action: 'pii';
      category?:
        | 'personal_identifier'
        | 'contact_info'
        | 'financial'
        | 'health'
        | 'sensitive';
    }
  | { match: string; action: 'nonpii' };

export type PIIKeywordPack = {
  include: string[]; // extra keywords considered PII
  exclude?: string[]; // keywords to remove from baseline
};

export type PIIFieldHints = {
  // optional explicit field paths that are PII (beats keyword heuristics)
  piiFields?: string[]; // e.g., ["customer.name", "profile.dob"]
  nonPiiFields?: string[]; // explicit exceptions
};

export interface PIIPolicyBundle {
  domain: string; // e.g., "entity", "payment-hub"
  tenant?: string; // optional tenant override
  keywords: PIIKeywordPack;
  fieldHints?: PIIFieldHints; // legacy/simple
  rules?: PIIRule[]; // NEW: path-aware rules (preferred)
  // per-category strategies (mask/encrypt/pseudo)
  protection?: Record<string, 'mask' | 'encrypt' | 'pseudonymize'>;
}

export interface PIIPolicyProvider {
  getPolicy(ctx: { domain: string; tenant?: string }): PIIPolicyBundle;
}

// DI token for PIIPolicyProvider
export const PII_POLICY_PROVIDER = Symbol('PII_POLICY_PROVIDER');
