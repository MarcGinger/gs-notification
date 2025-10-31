/**
 * Actor context that abstracts auth provider specifics
 * Used for tracking who is performing operations without coupling to JWT structures
 */
export interface ActorContext {
  userId: string; // from token.sub
  tenant: string; // multi-tenant support
  tenant_userId: string; // optional, from token.tenant_user_id
  username?: string; // optional, from token.username
  roles?: string[]; // optional, keep minimal for performance
}

/**
 * Enhanced tenant context with stronger tenant isolation
 */
export interface TenantContext extends ActorContext {
  tenant: string; // Make required for multi-tenant systems
  permissions: TenantPermission[];
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  region?: string; // Data residency requirements
}

export interface TenantPermission {
  resource: string;
  actions: string[];
  conditions?: Record<string, unknown>;
}

/**
 * Security context for compliance and encryption requirements
 */
export interface SecurityContext {
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  encryptionRequired: boolean;
  auditLevel: 'none' | 'basic' | 'detailed' | 'full';
  piiFields?: string[]; // Fields containing PII for masking
}
