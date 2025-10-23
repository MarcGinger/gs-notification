# Shared Domain Permissions

This directory contains the shared permission infrastructure that enables "permissions as code" patterns across different domain contexts while maintaining DRY principles.

## Overview

The shared permission infrastructure provides:

- **Base Types**: Common interfaces and types for permission metadata
- **Utility Classes**: Abstract base classes with common permission operations
- **Factory Methods**: Helpers for creating standardized permission metadata
- **Risk Assessment**: Consistent risk levels and validation patterns

## Core Components

### BasePermissionMeta Interface

```typescript
interface BasePermissionMeta {
  description: string;
  riskLevel: PermissionRiskLevel;
  requiresJustification: boolean;
  policyPath: string;
  category?: string;
  relatedPermissions?: string[];
  auditRequired?: boolean;
  name: string;
}
```

### BasePermissionUtils Abstract Class

Provides common utility methods that domain-specific permission utilities can extend:

```typescript
abstract class BasePermissionUtils<T extends string> {
  // Get permissions by risk level
  getPermissionsByRiskLevel(riskLevel: PermissionRiskLevel): T[];

  // Get high-risk permissions (HIGH/CRITICAL)
  getHighRiskPermissions(): T[];

  // Validate permission string format
  isValidPermissionString(permission: string): boolean;

  // Get permission metadata
  getPermissionMeta(permission: T): BasePermissionMeta | undefined;

  // Get related permissions
  getRelatedPermissions(permission: T): T[];
}
```

### PermissionFactory Class

Static factory methods for creating consistent permission metadata:

```typescript
class PermissionFactory {
  // Create CRUD permission metadata
  static createCrudMeta(
    resource: string,
    action: 'create' | 'read' | 'update' | 'delete',
  ): BasePermissionMeta;

  // Create custom permission metadata
  static createCustomMeta(
    description: string,
    riskLevel: PermissionRiskLevel,
    policyPath: string,
  ): BasePermissionMeta;

  // Create bulk operation permission metadata
  static createBulkMeta(
    resource: string,
    operation: string,
  ): BasePermissionMeta;

  // Create sensitive data access permission metadata
  static createSensitiveDataMeta(
    resource: string,
    dataType: string,
  ): BasePermissionMeta;
}
```

## Usage in Domain Contexts

### 1. Define Domain Permission Enum

```typescript
// src/catalog/domain/permissions/product.permissions.ts
export enum ProductPermissions {
  READ = 'catalog:product:read',
  CREATE = 'catalog:product:create',
  UPDATE = 'catalog:product:update',
  DELETE = 'catalog:product:delete',
  CHANNEL_CODE_ADD = 'catalog:product:channel-code:add',
  RAIL_CODE_ADD = 'catalog:product:rail-code:add',
}
```

### 2. Create Permission Registry

```typescript
import {
  BasePermissionRegistry,
  PermissionFactory,
} from '@shared/domain/permissions';

export const ProductPermissionRegistry: BasePermissionRegistry<ProductPermissions> =
  {
    [ProductPermissions.READ]: PermissionFactory.createCrudMeta(
      'product',
      'read',
    ),
    [ProductPermissions.CREATE]: PermissionFactory.createCrudMeta(
      'product',
      'create',
    ),
    [ProductPermissions.UPDATE]: PermissionFactory.createCrudMeta(
      'product',
      'update',
    ),
    [ProductPermissions.DELETE]: PermissionFactory.createCrudMeta(
      'product',
      'delete',
    ),
    [ProductPermissions.CHANNEL_CODE_ADD]: PermissionFactory.createCustomMeta(
      'Add channel codes to products',
      'MEDIUM',
      'catalog.product.channel-code.add',
    ),
    [ProductPermissions.RAIL_CODE_ADD]: PermissionFactory.createCustomMeta(
      'Add rail codes to products',
      'MEDIUM',
      'catalog.product.rail-code.add',
    ),
  };
```

### 3. Create Domain-Specific Utility Class

```typescript
import { BasePermissionUtils } from '@shared/domain/permissions';

export class ProductPermissionUtils extends BasePermissionUtils<ProductPermissions> {
  protected readonly permissionRegistry = ProductPermissionRegistry;

  // Add domain-specific utility methods if needed
  getChannelPermissions(): ProductPermissions[] {
    return Object.values(ProductPermissions).filter((p) =>
      p.includes('channel'),
    );
  }
}
```

### 4. Use in Application Services

```typescript
import {
  ProductPermissionUtils,
  ProductPermissions,
} from './domain/permissions';

@Injectable()
export class ProductService {
  private readonly permissionUtils = new ProductPermissionUtils();

  async createProduct(command: CreateProductCommand): Promise<Result<Product>> {
    // Check if permission requires justification
    const meta = this.permissionUtils.getPermissionMeta(
      ProductPermissions.CREATE,
    );
    if (meta?.requiresJustification && !command.justification) {
      return Result.failure('Justification required for product creation');
    }

    // Check authorization with OPA
    const authResult = await this.opaClient.evaluate({
      input: {
        permission: ProductPermissions.CREATE,
        user: command.userId,
        resource: 'product',
        action: 'create',
      },
    });

    // ... rest of implementation
  }
}
```

## Benefits

1. **DRY Compliance**: Common permission patterns are centralized and reusable
2. **Type Safety**: Full TypeScript support with compile-time checking
3. **Consistency**: Standardized metadata and utility patterns across domains
4. **Extensibility**: Easy to extend base classes for domain-specific needs
5. **Maintainability**: Changes to permission patterns propagate automatically
6. **Security**: Built-in risk assessment and validation patterns

## Risk Levels

- **LOW**: Basic read operations, minimal security impact
- **MEDIUM**: Create/update operations, moderate security impact
- **HIGH**: Bulk operations, administrative functions
- **CRITICAL**: Sensitive data access, system-wide changes

## Best Practices

1. **Permission Naming**: Use consistent format `domain:resource:action`
2. **Risk Assessment**: Always assign appropriate risk levels
3. **Justification**: Require justification for HIGH/CRITICAL permissions
4. **Documentation**: Include clear descriptions for all permissions
5. **Policy Paths**: Map to actual OPA policy paths
6. **Testing**: Write tests for permission utilities and metadata

## Integration Points

- **OPA Policies**: Policy paths map directly to OPA policy structure
- **Audit Logging**: Permission metadata drives audit requirements
- **UI Components**: Risk levels and descriptions feed permission UIs
- **Code Generation**: Permission enums can be generated from schemas
