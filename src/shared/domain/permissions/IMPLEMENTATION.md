# Migration Guide — Application‑Layer Authorization & Shared Permission Utilities

This guide walks you through migrating your Product (and sibling domains```

Create `src/shared/security/opa-authorization.service.ts` that **wraps existing OpaClient**:

```ts
@Injectable()
export class OpaAuthorizationService<P extends string>
  implements AuthorizationPort<P>
{
  constructor(
    private readonly opaClient: OpaClient, // ✅ Reuse existing client
    private readonly permissionRegistry: PermissionRegistry<P>,
    private readonly decisionLogger: DecisionLoggerService, // ✅ Reuse existing audit
  ) {}

  async check(args: AuthorizationRequest<P>): Promise<AuthorizationResult> {
    // Map to existing OPA input format from opa.types.ts
    const opaInput: OpaInput = {
      subject: {
        id: args.actor.userId,
        tenant: args.actor.tenantId,
        roles: args.actor.roles || [],
      },
      action: {
        type: this.getActionType(args.permissions[0]),
        name: args.permissions[0],
      },
      resource: {
        type: args.domain,
        tenant: args.actor.tenantId,
        id: args.resource?.id,
        ownerId: args.resource?.ownerId,
        attributes: args.resource?.attrs,
      },
      context: {
        correlationId: args.correlationId,
        time: new Date().toISOString(),
      },
    };

    // Use existing evaluate method with all its resilience patterns
    const decision = await this.opaClient.evaluate(
      this.resolvePolicyPath(args.permissions[0]),
      opaInput,
      {
        correlationId: args.correlationId,
        tenantId: args.actor.tenantId,
        userId: args.actor.userId,
      },
    );

    // ✅ Existing decision logging handles PII protection and sampling
    this.decisionLogger.logAuthorizationDecision(opaInput, decision, {
      correlationId: args.correlationId,
    });

    return {
      allowed: decision.allow,
      reason: decision.reason,
      obligations: decision.obligations || [],
    };
  }

  private resolvePolicyPath(permission: P): string {
    const meta = this.permissionRegistry[permission];
    return meta?.policyPath || 'authz.allow';
  }

  private getActionType(permission: P): string {
    // Extract action type from permission (e.g., 'DOMAIN_PRODUCT_CREATE' -> 'create')
    const parts = permission.split('_');
    return parts[parts.length - 1].toLowerCase();
  }
}
```

Provide **two** providers using existing patterns:

```ts
{
  provide: 'AuthorizationPort',
  useClass: process.env.FEATURE_APP_LAYER_AUTH === 'true'
    ? OpaAuthorizationService
    : NoopAuthorizationService,
}
```

- **Application‑layer authorization** using a generic `AuthorizationPort` (OPA‑backed by default).
- **Shared, generic permission utilities** (registry, roles, expansion, OPA input shaping).
- A **generic use‑case runner** that centralizes plumbing (logging, metadata, auth, FK validation, save).
- **Field‑level, patch‑aware permissions** for fine‑grained updates.

---

## 1) Outcomes

After this migration you will have:

- A single source of truth for permissions per domain with integrity checks.
- Consistent, testable authorization at the **application/service** boundary.
- Smaller use cases (Create/Update/etc.) that focus on domain semantics only.
- Easy extension to other domains (Rail, Fee, Channel, Currency, …).

---

## 2) Scope & Affected Modules

**New shared modules to create**

- `src/shared/domain/permissions/utils.ts` — generic registry/role helpers, OPA input shaping, set helpers.
- `src/shared/security/authorization.port.ts` — app‑layer authorization port.
- `src/shared/security/opa-authorization.service.ts` — OPA‑backed implementation of the port.

**Existing modules to extend**

- `src/shared/security/opa/opa.client.ts` ✅ — **Already production-ready** with circuit breaker, metrics, batch support
- `src/shared/security/audit/decision-logger.service.ts` ✅ — **Already comprehensive** with PII protection, sampling
- `src/shared/security/monitoring/security-monitoring.service.ts` ✅ — **Already implemented** with metrics and alerting

**Refactors needed**

- `src/contexts/product-config/application/utils/use-case.runner.ts` — generic runner extended with optional auth.
- `src/contexts/product-config/domain/permissions.ts` ✅ — **Already well-structured** but needs shared utils integration
- `src/contexts/product-config/application/security/product-field-perms.ts` — **NEW**: field→permission matrix.
- `CreateProductUseCase` / `UpdateProductUseCase` — now call the runner with `auth` options.

---

## 3) Prerequisites

✅ **Already Available**

- NestJS DI is already wired (you have `APP_LOGGER`, `CLOCK`, etc.).
- **OPA client exists and is production-ready** with circuit breaker, metrics, timeout handling
- **Comprehensive audit logging** with PII protection and sampling
- **Security monitoring** with alerting and metrics
- Unit test framework ready (Jest/Vitest) for quick feedback.

❌ **Need to Create**

- `AuthorizationPort<P>` interface as abstraction over existing OPA client
- Shared permission utilities (registry helpers, role expansion)
- Field-level permission matrices for patch-aware authorization

---

## 4) Step‑by‑Step Migration

### Step 0 — Feature Flag (optional but recommended)

Add an environment flag to control enforcement during rollout:

```env
FEATURE_APP_LAYER_AUTH=true
```

Use it to conditionally set the `AuthorizationPort` provider to a `NoopAuthorizationService` that always allows, then flip to OPA on.

---

### Step 1 — Add Shared Permission Utilities

Create `src/shared/domain/permissions/utils.ts` with:

```ts
// Generic utilities: registry creation, role hierarchy, set algebra, OPA input shaping
// (See full version from our conversation; keep file @ ~200 LOC)
export type PermissionRegistry<P extends string> = Readonly<
  Record<P, BasePermissionMeta>
>;
export type RoleHierarchy<
  P extends string,
  R extends string = string,
> = Readonly<Record<R, readonly P[]>>;

export function createPermissionRegistry<
  P extends string,
  R extends PermissionRegistry<P>,
>(registry: R): Readonly<R> {
  return Object.freeze(registry);
}
export function createRoleHierarchy<
  P extends string,
  RH extends RoleHierarchy<P, any>,
>(hierarchy: RH): Readonly<RH> {
  return Object.freeze(hierarchy);
}
export function assertRegistryComplete<P extends string>(
  all: readonly P[],
  reg: PermissionRegistry<P>,
): void {
  const missing = all.filter((p) => !(p in reg));
  if (missing.length)
    throw new Error(
      `PermissionRegistry incomplete. Missing: ${missing.join(', ')}`,
    );
}
export function expandRelated<P extends string>(
  reg: PermissionRegistry<P>,
  seed: readonly P[],
): P[] {
  /* … */ return [];
}
export function buildOpaInput<P extends string>(/* … */) {
  /* … */
}
```

> Tip: Keep this file **framework‑agnostic** (no NestJS imports).

---

### Step 2 — Create AuthorizationPort & OPA Service

✅ **Leverage Existing OPA Infrastructure**

The existing `OpaClient` is production-ready with:

- Circuit breaker pattern for resilience
- Comprehensive error handling and timeouts
- Batch evaluation support
- Metrics and monitoring integration
- Correlation ID propagation

Create `src/shared/security/authorization.port.ts`:

```ts
export interface AuthorizationPort<P extends string> {
  check(args: {
    domain: string;
    permissions: readonly P[];
    anyOf?: boolean;
    actor: { userId: string; tenantId: string; roles?: string[] };
    resource?: {
      type?: string;
      id?: string;
      ownerId?: string;
      attrs?: Record<string, unknown>;
    };
    tenantScope?: PermissionTenantScope;
    correlationId: string;
  }): Promise<Result<{ allowed: boolean; reason?: string }, DomainError>>;
}
```

Create `src/shared/security/opa-authorization.service.ts` implementing the port using the utils’ `buildOpaInput` and your `opaClient.allow(input)`.

Provide **two** providers:

- `OpaAuthorizationService` — real checks.
- `NoopAuthorizationService` — always allows (for phased rollout or local dev).

---

### Step 3 — Wire DI Providers

In the product module (or a shared security module), bind the port:

```ts
{
  provide: AuthorizationPortToken, // e.g., a symbol or string token
  useExisting: process.env.FEATURE_APP_LAYER_AUTH === 'true' ? OpaAuthorizationService : NoopAuthorizationService,
}
```

Inject this port into your application layer use cases **via the runner args** (see Step 6/7).

---

### Step 4 — Extend the Generic Use‑Case Runner

Update `src/contexts/product-config/application/utils/use-case.runner.ts` to accept optional `auth` and `permissions`/`fieldPermissionMatrix`. The runner should:

1. Do existing logging + metadata.
2. (If `auth` provided) Run **static** permission check for the use case (e.g., CREATE/UPDATE).
3. (If `fieldPermissionMatrix` provided) Derive **patch‑aware** required permissions and check them.
4. Proceed with FK validation → domain factory → repository save.

> Keep the runner **pure**; inject services via args, not module scope.

---

### Step 5 — Refactor Product Permissions to Use Shared Utils

Convert `domain/permissions.ts` to:

- A `ProductPermission` enum.
- `ProductPermissionRegistry = createPermissionRegistry({...})`.
- `ProductPermissionHierarchy = createRoleHierarchy({...})`.
- Run `assertRegistryComplete(Object.values(ProductPermission), ProductPermissionRegistry)` at boot/tests.

This enforces registry completeness and gives you generic helpers for audits (index by risk/op type) and UIs.

---

### Step 6 — Add Field→Permission Matrix (Patch‑Aware)

Create `application/security/product-field-perms.ts`:

```ts
export const ProductUpdateFieldPerms = {
  name: [ProductPermission.DOMAIN_PRODUCT_UPDATE],
  description: [ProductPermission.DOMAIN_PRODUCT_UPDATE],
  active: [
    ProductPermission.DOMAIN_PRODUCT_UPDATE,
    ProductPermission.DOMAIN_PRODUCT_ADMIN,
  ],
  channelCodes: [ProductPermission.DOMAIN_PRODUCT_UPDATE],
  railCodes: [ProductPermission.DOMAIN_PRODUCT_UPDATE],
  fees: [ProductPermission.DOMAIN_PRODUCT_UPDATE],
} as const;
```

Add a small helper `permsForPatch(matrix, props)` in shared security to derive required perms from `command.props` keys.

---

### Step 7 — Update Create/Update Use Cases

Keep constructors clean; `execute()` becomes a thin call to the runner:

- **Create**: pass `permissions: [DOMAIN_PRODUCT_CREATE]`.
- **Update**: pass `permissions: [DOMAIN_PRODUCT_UPDATE]` **and** `fieldPermissionMatrix: ProductUpdateFieldPerms`.

Example (Update):

```ts
return runProductUseCase({
  component: 'UpdateProductUseCase',
  operation: 'update_product',
  source: 'product-config.application.update-product',
  command,
  logger: this.logger,
  clock: this.clock,
  repo: this.productRepository,
  fkValidator: this.foreignKeyValidator,
  propsMissingError: ProductErrors.INVALID_PRODUCT_DATA,
  auth: this.authorization,        // AuthorizationPort<ProductPermission>
  domain: 'product',
  permissions: [ProductPermission.DOMAIN_PRODUCT_UPDATE],
  fieldPermissionMatrix: ProductUpdateFieldPerms,
  loadExisting: /* your findById → snapshot */,
  runDomain: /* updateProductAggregateFromSnapshot */,
});
```

---

### Step 8 — Tests

**Unit**

- Registry completeness: `assertRegistryComplete` does not throw.
- `expandRelated()` and `roleHasPermission()` cover your implications/hierarchy.
- `permsForPatch()` returns the expected perms for various patches.
- Runner denies when `AuthorizationPort` returns `allowed: false`.

**Integration**

- Use a fake OPA client; assert `buildOpaInput()` shape and that checks fire in the expected order (static → patch‑aware → FK validation …).

**E2E**

- With `FEATURE_APP_LAYER_AUTH=true`, requests lacking permission are denied.
- With `FEATURE_APP_LAYER_AUTH=false`, behavior matches pre‑migration.

---

### Step 9 — Observability

- Add structured log fields for `authorization.decision`, `requiredPermissions`, `anyOf`.
- Emit a metric counter for `auth_denied_total{domain,permission}`.
- Trace spans around OPA RPCs (`opa.allow`) to observe latency and error rates.

---

### Step 10 — Rollout Plan

1. Ship code with `NoopAuthorizationService` default; run in **shadow mode** (log would‑deny decisions, don’t block).
2. Enable `FEATURE_APP_LAYER_AUTH=true` in **staging**; run tests + manual exploratory.
3. Enable in **production** for low‑risk routes first (READ), then writes.
4. Monitor metrics/logs; roll back by flipping the feature flag.

---

## 5) Diff‑Friendly Checklist

- [ ] Add `permissions/utils.ts` (shared) ✅
- [ ] Add `authorization.port.ts` + `opa-authorization.service.ts` ✅
- [ ] Bind `AuthorizationPort` provider with feature flag ✅
- [ ] Extend `use-case.runner.ts` with `auth` & field matrix ✅
- [ ] Refactor `domain/permissions.ts` to use `createPermissionRegistry` ✅
- [ ] Add `product-field-perms.ts` ✅
- [ ] Update `CreateProductUseCase` & `UpdateProductUseCase` ✅
- [ ] Add unit/integration tests ✅
- [ ] Add logs/metrics around auth decisions ✅
- [ ] Stage → Prod rollout with feature flag ✅

---

## 6) FAQs

**Q: Why app‑layer instead of controller guards?**
A: The application layer knows _business_ semantics (patch shape, FK preconditions). It’s the right layer to combine coarse and fine‑grained checks, emit domain‑aware logs, and coordinate with domain factories.

**Q: Can we mix both?**
A: Yes. Use controller guards for edge‑caching/global read policies; keep write/patch nuance in the service layer.

**Q: How do we handle “justification required”?**
A: Extend `AuthorizationPort` to return obligations (e.g., `requiresJustification: true`). The use case can raise a domain error that workflow/UI interprets to prompt for justification.

**Q: Multi‑domain?**
A: Duplicate the domain‑local file trio per domain: `permissions.ts`, `*-field-perms.ts`, use cases. All share the same shared utils + port.

---

## 7) Application Service Integration Example

Based on current security infrastructure review, here's how to integrate the AuthorizationPort with existing OPA client:

### Current vs. Target Architecture

**Current State (Controller-Level)**

```
Request → JwtAuthGuard → OpaGuard → Controller → Use Case
```

**Target State (Application-Layer)**

```
Request → JwtAuthGuard → Controller → App Service → AuthorizationPort → Use Case Runner
                                                        ↓
                                                   OpaClient (existing)
```

### Recommended Application Service Pattern

```typescript
@Injectable()
export class ProductApplicationService {
  constructor(
    private readonly authorization: AuthorizationPort<ProductPermission>,
    private readonly useCaseRunner: ProductUseCaseRunner,
    @Inject(APP_LOGGER) moduleLogger: Logger,
  ) {}

  async createProduct(
    user: IUserToken,
    props: CreateProductProps,
  ): Promise<Result<ProductAggregate, DomainError>> {
    // Delegate to use-case runner with authorization context
    return this.useCaseRunner.execute({
      operation: 'create_product',
      user,
      authorization: this.authorization,
      permissions: [ProductPermission.DOMAIN_PRODUCT_CREATE],
      domain: 'product',
      factory: (props) => CreateProductUseCase.execute(props),
      props,
    });
  }

  async updateProduct(
    user: IUserToken,
    id: string,
    props: UpdateProductProps,
  ): Promise<Result<ProductAggregate, DomainError>> {
    return this.useCaseRunner.execute({
      operation: 'update_product',
      user,
      authorization: this.authorization,
      permissions: [ProductPermission.DOMAIN_PRODUCT_UPDATE],
      fieldPermissionMatrix: ProductUpdateFieldPerms,
      domain: 'product',
      factory: (context) =>
        UpdateProductUseCase.execute({ id, props, ...context }),
      props: { id, ...props },
    });
  }
}
```

### Key Differences from Proposed Service

#### 1. **Use Existing Permission Format**

```typescript
// ✅ Use actual enum from product.permissions.ts
import { ProductPermission } from './domain/permissions/product.permissions';

// Not: ProductPermissions.CREATE (colon format)
// Use: ProductPermission.DOMAIN_PRODUCT_CREATE
```

#### 2. **AuthorizationPort Integration**

```typescript
// ✅ Inject AuthorizationPort instead of direct OpaClient
constructor(
  private readonly authorization: AuthorizationPort<ProductPermission>,
  // Not: private readonly opa: OpaClient,
) {}
```

#### 3. **Delegate to Use-Case Runner**

```typescript
// ✅ Let runner handle authorization + domain logic
return this.useCaseRunner.execute({
  authorization: this.authorization,
  permissions: [ProductPermission.DOMAIN_PRODUCT_CREATE],
  // ...
});

// Not: Manual authorization in application service
```

#### 4. **Field-Level Permissions for Updates**

```typescript
// ✅ Include field permission matrix for patch-aware auth
fieldPermissionMatrix: ProductUpdateFieldPerms,
```

---

## 8) Appendix — Minimal Code Stubs

> Use these if you need placeholders to compile; replace with full versions from your codebase.

```ts
// authorization.port.ts (stub)
export class NoopAuthorizationService<P extends string>
  implements AuthorizationPort<P>
{
  async check(): Promise<Result<{ allowed: boolean }, any>> {
    return ok({ allowed: true });
  }
}
```

```ts
// permissions/utils.ts (stubs for compile)
export function expandRelated<P extends string>(
  _: any,
  seed: readonly P[],
): P[] {
  return [...seed];
}
export function buildOpaInput<P extends string>(args: any) {
  return args;
}
```

### Integration with Existing OPA Infrastructure

```typescript
// opa-authorization.service.ts - Bridge to existing OPA client
@Injectable()
export class OpaAuthorizationService<P extends string>
  implements AuthorizationPort<P>
{
  constructor(
    private readonly opaClient: OpaClient, // Existing OPA client
    private readonly permissionRegistry: PermissionRegistry<P>,
  ) {}

  async check(args: AuthorizationRequest<P>): Promise<AuthorizationResult> {
    // Build OPA input using existing client patterns
    const opaInput = this.buildOpaInput(args);

    // Use existing OpaClient.evaluate method
    const decision = await this.opaClient.evaluate(
      this.resolvePolicyPath(args.permissions[0]),
      opaInput,
      {
        correlationId: args.context?.correlationId,
        tenantId: args.actor.tenantId,
        userId: args.actor.userId,
      },
    );

    return {
      allowed: decision.allow,
      reason: decision.reason,
      obligations: decision.obligations || [],
    };
  }

  private buildOpaInput(args: AuthorizationRequest<P>) {
    // Leverage existing OPA input structure from opa.types.ts
    return {
      subject: {
        id: args.actor.userId,
        tenant: args.actor.tenantId,
        roles: args.actor.roles || [],
      },
      action: {
        type: this.getActionType(args.permissions[0]),
        name: args.permissions[0],
      },
      resource: {
        type: args.domain,
        tenant: args.actor.tenantId,
        ...args.resource?.attrs,
      },
      context: {
        correlationId: args.context?.correlationId || '',
        time: new Date().toISOString(),
      },
    };
  }

  private resolvePolicyPath(permission: P): string {
    const meta = this.permissionRegistry[permission];
    // Extract policy path from existing metadata
    return meta?.policyPath || 'authz.allow';
  }
}
```

### Common Pitfalls from Proposed Application Service Review

#### ❌ **Pitfall 1: Permission Format Mismatch**

```typescript
// DON'T: Use colon-separated format when implementation uses constants
ProductPermissions.CREATE = 'product:create';

// DO: Use actual enum values from existing permissions file
ProductPermission.DOMAIN_PRODUCT_CREATE = 'DOMAIN_PRODUCT_CREATE';
```

#### ❌ **Pitfall 2: Direct OPA Client Usage**

```typescript
// DON'T: Inject OpaClient directly in application service
constructor(private readonly opa: OpaClient) {}

// DO: Use AuthorizationPort abstraction
constructor(private readonly authorization: AuthorizationPort<ProductPermission>) {}
```

#### ❌ **Pitfall 3: Authorization in Application Service**

```typescript
// DON'T: Handle authorization logic in application service
async create(user: IUserToken, props: CreateProductProps) {
  const authResult = await this.authorizeAction(user, ProductPermissions.CREATE);
  if (!authResult.ok) return authResult;
  // ... rest of logic
}

// DO: Delegate to use-case runner with authorization context
async create(user: IUserToken, props: CreateProductProps) {
  return this.useCaseRunner.execute({
    authorization: this.authorization,
    permissions: [ProductPermission.DOMAIN_PRODUCT_CREATE],
    // ...
  });
}
```

#### ❌ **Pitfall 4: Missing Field-Level Permissions**

```typescript
// DON'T: Single permission for all update operations
const authResult = await this.authorizeAction(user, ProductPermissions.UPDATE);

// DO: Field-aware permission checking
return this.useCaseRunner.execute({
  permissions: [ProductPermission.DOMAIN_PRODUCT_UPDATE],
  fieldPermissionMatrix: ProductUpdateFieldPerms,
  // Automatically derives required permissions based on changed fields
});
```

#### ❌ **Pitfall 5: Custom Permission Helpers vs. Shared Registry**

```typescript
// DON'T: Create custom permission helper classes
ProductPermissionHelpers.getRiskLevel(ProductPermissions.CREATE);

// DO: Use shared permission registry with type safety
productPermissionGuard.getRiskLevel(ProductPermission.DOMAIN_PRODUCT_CREATE);
```

---

## 8) Corrected Application Service Example

Here's how the proposed service should be refactored to align with the migration guide:

```typescript
@Injectable()
export class ProductApplicationService {
  constructor(
    private readonly authorization: AuthorizationPort<ProductPermission>,
    private readonly useCaseRunner: ProductUseCaseRunner,
    private readonly cls: ClsService,
    @Inject(APP_LOGGER) moduleLogger: Logger,
  ) {
    this.logger = componentLogger(moduleLogger, 'ProductApplicationService');
  }

  /**
   * ✅ CORRECTED: Delegates to use-case runner with proper authorization
   */
  async createProduct(
    user: IUserToken,
    props: CreateProductProps,
  ): Promise<Result<ProductAggregate, DomainError>> {
    return this.useCaseRunner.execute({
      component: 'CreateProductUseCase',
      operation: 'create_product',
      source: 'product-config.application.create-product',
      user,
      props,
      logger: this.logger,
      clock: SystemClock.instance,

      // ✅ Authorization handled by runner
      authorization: this.authorization,
      domain: 'product',
      permissions: [ProductPermission.DOMAIN_PRODUCT_CREATE],

      // ✅ Business logic delegation
      factory: (context) => CreateProductUseCase.execute(context),
    });
  }

  /**
   * ✅ CORRECTED: Field-aware permissions for updates
   */
  async updateProduct(
    user: IUserToken,
    id: string,
    props: UpdateProductProps,
  ): Promise<Result<ProductAggregate, DomainError>> {
    return this.useCaseRunner.execute({
      component: 'UpdateProductUseCase',
      operation: 'update_product',
      source: 'product-config.application.update-product',
      user,
      props: { id, ...props },
      logger: this.logger,
      clock: SystemClock.instance,

      // ✅ Field-level permission checking
      authorization: this.authorization,
      domain: 'product',
      permissions: [ProductPermission.DOMAIN_PRODUCT_UPDATE],
      fieldPermissionMatrix: ProductUpdateFieldPerms,

      // ✅ Load existing for updates
      loadExisting: (id) => this.productRepository.findById(id),
      factory: (context) => UpdateProductUseCase.execute(context),
    });
  }

  /**
   * ✅ CORRECTED: High-risk operation with proper audit
   */
  async deleteProduct(
    user: IUserToken,
    id: string,
  ): Promise<Result<void, DomainError>> {
    // Check if justification required before executing
    if (
      productPermissionGuard.requiresJustification(
        ProductPermission.DOMAIN_PRODUCT_DELETE,
      )
    ) {
      // In real implementation, check if justification was provided
      Log.warn(this.logger, 'High-risk deletion requires justification', {
        productId: id,
        permission: ProductPermission.DOMAIN_PRODUCT_DELETE,
        riskLevel: productPermissionGuard.getRiskLevel(
          ProductPermission.DOMAIN_PRODUCT_DELETE,
        ),
      });
    }

    return this.useCaseRunner.execute({
      component: 'DeleteProductUseCase',
      operation: 'delete_product',
      source: 'product-config.application.delete-product',
      user,
      props: { id },
      logger: this.logger,
      clock: SystemClock.instance,

      authorization: this.authorization,
      domain: 'product',
      permissions: [ProductPermission.DOMAIN_PRODUCT_DELETE],

      factory: (context) => DeleteProductUseCase.execute(context),
    });
  }

  /**
   * ✅ CORRECTED: Proper bulk operation handling
   */
  async bulkUpdateProducts(
    user: IUserToken,
    productIds: string[],
    props: UpdateProductProps,
  ): Promise<Result<ProductAggregate[], DomainError>> {
    return this.useCaseRunner.execute({
      component: 'BulkUpdateProductUseCase',
      operation: 'bulk_update_products',
      source: 'product-config.application.bulk-update-products',
      user,
      props: { productIds, updateProps: props },
      logger: this.logger,
      clock: SystemClock.instance,

      // ✅ Bulk permission with proper risk handling
      authorization: this.authorization,
      domain: 'product',
      permissions: [ProductPermission.DOMAIN_PRODUCT_BULK_EXPORT], // Use actual bulk permission

      factory: (context) => BulkUpdateProductUseCase.execute(context),
    });
  }

  /**
   * ✅ CORRECTED: Query operations with minimal authorization
   */
  async findProducts(
    user: IUserToken,
    filter?: ProductListFilterProps,
  ): Promise<Result<ProductPaginationProps, DomainError>> {
    // Simple read operations can use minimal runner or direct query execution
    const authResult = await this.authorization.check({
      domain: 'product',
      permissions: [ProductPermission.DOMAIN_PRODUCT_READ],
      actor: {
        userId: user.sub,
        tenantId: user.tenant_id || user.tenant,
        roles: user.roles,
      },
      correlationId: CorrelationUtil.ensure(this.cls),
    });

    if (!authResult.ok) {
      return err(/* map authorization error */);
    }

    // Execute query directly (reads don't need full runner overhead)
    const query = new ListProductsQuery(user, filter || {});
    return await this.queryBus.execute(query);
  }
}
```

### Key Improvements in Corrected Version

1. **✅ Proper Permission Enum**: Uses `ProductPermission.DOMAIN_PRODUCT_CREATE`
2. **✅ AuthorizationPort**: Injects abstraction instead of direct OPA client
3. **✅ Use-Case Runner**: Delegates authorization to runner layer
4. **✅ Field-Level Permissions**: Includes `fieldPermissionMatrix` for updates
5. **✅ Existing Registry**: Uses `productPermissionGuard` instead of custom helpers
6. **✅ Read Optimization**: Simple authorization for query operations
7. **✅ Bulk Operations**: Proper bulk permission handling

---

## 10) Key Takeaways from Application Service Review

### ✅ **What Was Done Well in Proposed Service**

1. **CQRS Separation**: Proper command/query segregation with CommandBus/QueryBus
2. **Correlation Context**: Good use of CLS and CorrelationUtil for tracing
3. **Structured Logging**: Component logger with contextual information
4. **Error Handling**: Consistent Result type usage with error context enrichment
5. **Risk-Based Security**: Awareness of high-risk operations requiring special handling

### ❌ **Critical Issues Identified**

1. **Permission Format Mismatch**: Used colon format instead of actual enum constants
2. **Direct OPA Usage**: Bypassed AuthorizationPort abstraction pattern
3. **Authorization in Wrong Layer**: Security logic in application service instead of use-case runner
4. **Missing Field-Level Permissions**: No patch-aware authorization for updates
5. **Custom vs. Shared Utilities**: Created custom helpers instead of using permission registry

### 🎯 **Integration Strategy**

- **Phase 1**: Create AuthorizationPort wrapper around existing OpaClient
- **Phase 2**: Implement shared permission utilities and field-level matrices
- **Phase 3**: Migrate application services to use use-case runner pattern
- **Phase 4**: Add enhanced observability and monitoring

### 🏗️ **Architecture Decision**

Keep the **existing production-ready OPA infrastructure** (circuit breaker, audit, monitoring) and build the new authorization abstraction **on top of it** rather than replacing it.

---

## 11) Rollback

- Keep `NoopAuthorizationService` available.
- Guard runner usage with the feature flag; if issues arise, **flip off** to bypass authorization while keeping the new structure.
- Revert permission refactors last—they’re additive and low‑risk once tests pass.

---

**End of Guide**
