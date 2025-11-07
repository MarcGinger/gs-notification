import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { TenantContext, createTenantContext } from 'src/shared/domain/tenant';

/**
 * Tenant Resolver Service
 *
 * Extracts tenant context from incoming HTTP requests using various strategies:
 * - HTTP headers (X-Tenant-ID, X-Organization-ID)
 * - JWT token claims
 * - Request metadata
 * - Default fallback logic
 */
@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);

  /**
   * Extract tenant context from HTTP request
   */
  resolveTenantFromRequest(request: Request): TenantContext {
    this.logger.debug('Resolving tenant context from request');

    // Strategy 1: Check X-Tenant-ID header
    const tenantIdHeader = request.headers['x-tenant-id'] as string;
    if (tenantIdHeader) {
      this.logger.debug('Found tenant ID in header', {
        tenantId: tenantIdHeader,
      });
      return this.createTenantContextFromHeader(tenantIdHeader, request);
    }

    // Strategy 2: Extract from JWT token (if available)
    const jwtTenant = this.extractTenantFromJWT(request);
    if (jwtTenant) {
      this.logger.debug('Found tenant ID in JWT', {
        tenantId: jwtTenant.tenantId,
      });
      return jwtTenant;
    }

    // Strategy 3: Check subdomain or domain-based routing
    const domainTenant = this.extractTenantFromDomain(request);
    if (domainTenant) {
      this.logger.debug('Found tenant ID from domain', {
        tenantId: domainTenant.tenantId,
      });
      return domainTenant;
    }

    // Strategy 4: Default fallback to 'core' tenant
    this.logger.warn('No tenant context found, falling back to default');
    return this.getDefaultTenantContext();
  }

  /**
   * Resolve tenant context from service-to-service calls
   */
  resolveTenantFromServiceContext(
    tenantId?: string,
    metadata?: Record<string, unknown>,
  ): TenantContext {
    if (tenantId) {
      return createTenantContext(tenantId, {
        metadata,
      });
    }

    this.logger.warn(
      'No tenant ID provided for service context, using default',
    );
    return this.getDefaultTenantContext();
  }

  /**
   * Create tenant context from header with additional request metadata
   */
  private createTenantContextFromHeader(
    tenantId: string,
    request: Request,
  ): TenantContext {
    const organizationId = request.headers['x-organization-id'] as string;
    const tenantTier = request.headers['x-tenant-tier'] as
      | 'free'
      | 'professional'
      | 'enterprise';
    const region = request.headers['x-region'] as string;

    return createTenantContext(tenantId, {
      organizationId,
      tenantTier,
      region,
      metadata: {
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        requestId: request.headers['x-request-id'],
      },
    });
  }

  /**
   * Extract tenant information from JWT token claims
   * TODO: Implement actual JWT parsing when authentication is added
   */
  private extractTenantFromJWT(request: Request): TenantContext | null {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      // TODO: Parse JWT and extract tenant claims
      // const token = authHeader.substring(7);
      // const decoded = jwt.verify(token, JWT_SECRET);
      // return createTenantContext(decoded.tenantId, { ... });

      this.logger.debug('JWT parsing not implemented yet');
      return null;
    } catch (error) {
      this.logger.error('Failed to extract tenant from JWT', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Extract tenant from domain/subdomain
   * Supports patterns like: {tenant}.app.com or app.{tenant}.com
   */
  private extractTenantFromDomain(request: Request): TenantContext | null {
    try {
      const host = request.headers.host;
      if (!host) {
        return null;
      }

      // Pattern: {tenant}.gs.com or {tenant}.localhost
      const subdomainMatch = host.match(/^([^.]+)\.(gs\.com|localhost)/);
      if (
        subdomainMatch &&
        subdomainMatch[1] !== 'www' &&
        subdomainMatch[1] !== 'api'
      ) {
        const tenantId = subdomainMatch[1];
        return createTenantContext(tenantId, {
          metadata: {
            resolveStrategy: 'subdomain',
            originalHost: host,
          },
        });
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to extract tenant from domain', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get default tenant context for fallback scenarios
   */
  private getDefaultTenantContext(): TenantContext {
    return createTenantContext('core', {
      tenantName: 'Core System',
      tenantTier: 'enterprise',
      metadata: {
        isDefault: true,
        resolveStrategy: 'fallback',
      },
    });
  }

  /**
   * Validate that a tenant context is valid for the current request
   */
  validateTenantAccess(
    tenantContext: TenantContext,
    _request?: Request,
  ): boolean {
    try {
      // TODO: Implement tenant access validation
      // - Check if user has access to this tenant
      // - Verify tenant is active/enabled
      // - Check tenant-specific permissions

      this.logger.debug('Tenant access validation not implemented', {
        tenantId: tenantContext.tenantId,
      });

      return true; // Allow all for now
    } catch (error) {
      this.logger.error('Tenant access validation failed', {
        tenantId: tenantContext.tenantId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}
