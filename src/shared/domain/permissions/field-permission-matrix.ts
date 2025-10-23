/**
 * Field-Level Permission Matrix
 *
 * Defines fine-grained authorization for individual fields within domain entities.
 * This supports patch-aware authorization where different permissions may be required
 * for different fields during update operations.
 *
 * Used for scenarios like:
 * - Product status transitions requiring higher permissions
 * - Financial data fields requiring specialized access
 * - Audit fields that only certain roles can modify
 */

/**
 * Field permission specification
 */
export interface FieldPermissionSpec<P extends string> {
  /** The field path (supports dot notation for nested fields) */
  field: string;
  /** Operations allowed on this field */
  operations: FieldOperation[];
  /** Permissions required for each operation */
  permissions: {
    [K in FieldOperation]?: P[];
  };
  /** Additional constraints for this field */
  constraints?: FieldConstraint[];
  /** Human-readable description */
  description?: string;
}

/**
 * Supported field operations
 */
export type FieldOperation = 'read' | 'write' | 'create' | 'update' | 'delete';

/**
 * Field-level constraints
 */
export interface FieldConstraint {
  type: 'immutable' | 'append-only' | 'workflow' | 'validation' | 'audit';
  /** Constraint-specific configuration */
  config?: Record<string, any>;
  /** Error message when constraint is violated */
  message?: string;
}

/**
 * Field permission matrix for an entity type
 */
export interface FieldPermissionMatrix<P extends string> {
  /** Entity type this matrix applies to */
  entityType: string;
  /** Domain context */
  domain: string;
  /** Default permissions for unlisted fields */
  defaultPermissions: {
    [K in FieldOperation]?: P[];
  };
  /** Field-specific permission specifications */
  fields: FieldPermissionSpec<P>[];
  /** Matrix metadata */
  metadata: {
    version: string;
    lastUpdated: string;
    description: string;
  };
}

/**
 * Request for field-level authorization
 */
export interface FieldAuthorizationRequest<P extends string> {
  /** Entity type being accessed */
  entityType: string;
  /** Domain context */
  domain: string;
  /** Operation being performed */
  operation: FieldOperation;
  /** Fields being accessed */
  fields: string[];
  /** Actor permissions */
  actorPermissions: P[];
  /** Current entity state (for update operations) */
  currentValue?: Record<string, any>;
  /** Proposed changes (for update operations) */
  proposedChanges?: Record<string, any>;
}

/**
 * Result of field-level authorization
 */
export interface FieldAuthorizationResult {
  /** Overall authorization result */
  allowed: boolean;
  /** Per-field authorization results */
  fieldResults: FieldAuthorizationFieldResult[];
  /** Denied fields */
  deniedFields: string[];
  /** Required permissions for denied fields */
  missingPermissions: string[];
  /** Constraint violations */
  violations: ConstraintViolation[];
}

/**
 * Per-field authorization result
 */
export interface FieldAuthorizationFieldResult {
  /** Field path */
  field: string;
  /** Whether this field is allowed */
  allowed: boolean;
  /** Reason for denial (if applicable) */
  reason?: string;
  /** Required permissions for this field */
  requiredPermissions?: string[];
  /** Constraint violations for this field */
  violations?: ConstraintViolation[];
}

/**
 * Constraint violation details
 */
export interface ConstraintViolation {
  /** Field that violated the constraint */
  field: string;
  /** Type of constraint violated */
  constraintType: string;
  /** Violation message */
  message: string;
  /** Additional context */
  context?: Record<string, any>;
}

/**
 * Field authorization evaluator
 */
export class FieldAuthorizationEvaluator<P extends string> {
  constructor(
    private readonly matrices: Map<string, FieldPermissionMatrix<P>>,
  ) {}

  /**
   * Evaluate field-level authorization
   */
  evaluate(request: FieldAuthorizationRequest<P>): FieldAuthorizationResult {
    const matrixKey = `${request.domain}:${request.entityType}`;
    const matrix = this.matrices.get(matrixKey);

    if (!matrix) {
      // No matrix found - use permissive default
      return {
        allowed: true,
        fieldResults: request.fields.map((field) => ({
          field,
          allowed: true,
          reason: 'No field matrix defined - allowing all',
        })),
        deniedFields: [],
        missingPermissions: [],
        violations: [],
      };
    }

    const fieldResults: FieldAuthorizationFieldResult[] = [];
    const deniedFields: string[] = [];
    const missingPermissions: string[] = [];
    const violations: ConstraintViolation[] = [];

    // Check each field
    for (const fieldPath of request.fields) {
      const fieldResult = this.evaluateField(fieldPath, request, matrix);

      fieldResults.push(fieldResult);

      if (!fieldResult.allowed) {
        deniedFields.push(fieldPath);
        if (fieldResult.requiredPermissions) {
          missingPermissions.push(...fieldResult.requiredPermissions);
        }
      }

      if (fieldResult.violations) {
        violations.push(...fieldResult.violations);
      }
    }

    return {
      allowed: deniedFields.length === 0 && violations.length === 0,
      fieldResults,
      deniedFields: [...new Set(deniedFields)],
      missingPermissions: [...new Set(missingPermissions)],
      violations,
    };
  }

  /**
   * Evaluate authorization for a single field
   */
  private evaluateField(
    fieldPath: string,
    request: FieldAuthorizationRequest<P>,
    matrix: FieldPermissionMatrix<P>,
  ): FieldAuthorizationFieldResult {
    // Find field specification (exact match or pattern match)
    const fieldSpec = this.findFieldSpec(fieldPath, matrix.fields);

    // Determine required permissions
    const requiredPermissions = this.getRequiredPermissions(
      fieldSpec,
      request.operation,
      matrix.defaultPermissions,
    );

    // Check if actor has required permissions
    const hasPermissions = requiredPermissions.every((perm) =>
      request.actorPermissions.includes(perm),
    );

    // Check constraints
    const constraintViolations = this.checkConstraints(
      fieldPath,
      fieldSpec,
      request,
    );

    const allowed = hasPermissions && constraintViolations.length === 0;

    return {
      field: fieldPath,
      allowed,
      reason: !allowed
        ? this.buildDenialReason(hasPermissions, constraintViolations)
        : undefined,
      requiredPermissions: !hasPermissions ? requiredPermissions : undefined,
      violations:
        constraintViolations.length > 0 ? constraintViolations : undefined,
    };
  }

  /**
   * Find field specification by path (supports pattern matching)
   */
  private findFieldSpec(
    fieldPath: string,
    fieldSpecs: FieldPermissionSpec<P>[],
  ): FieldPermissionSpec<P> | undefined {
    // Try exact match first
    let spec = fieldSpecs.find((spec) => spec.field === fieldPath);

    if (!spec) {
      // Try pattern matching for nested paths
      spec = fieldSpecs.find((spec) => {
        // Support wildcard patterns like "config.*" or "metadata.audit.*"
        if (spec.field.endsWith('*')) {
          const prefix = spec.field.slice(0, -1);
          return fieldPath.startsWith(prefix);
        }
        return false;
      });
    }

    return spec;
  }

  /**
   * Get required permissions for field operation
   */
  private getRequiredPermissions(
    fieldSpec: FieldPermissionSpec<P> | undefined,
    operation: FieldOperation,
    defaultPermissions: { [K in FieldOperation]?: P[] },
  ): P[] {
    // Use field-specific permissions if available
    if (fieldSpec?.permissions[operation]) {
      return fieldSpec.permissions[operation] || [];
    }

    // Fall back to default permissions
    return defaultPermissions[operation] || [];
  }

  /**
   * Check field constraints
   */
  private checkConstraints(
    fieldPath: string,
    fieldSpec: FieldPermissionSpec<P> | undefined,
    request: FieldAuthorizationRequest<P>,
  ): ConstraintViolation[] {
    if (!fieldSpec?.constraints) {
      return [];
    }

    const violations: ConstraintViolation[] = [];

    for (const constraint of fieldSpec.constraints) {
      const violation = this.checkConstraint(fieldPath, constraint, request);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  /**
   * Check a specific constraint
   */
  private checkConstraint(
    fieldPath: string,
    constraint: FieldConstraint,
    request: FieldAuthorizationRequest<P>,
  ): ConstraintViolation | null {
    switch (constraint.type) {
      case 'immutable':
        if (
          request.operation === 'update' &&
          request.proposedChanges?.[fieldPath] !== undefined
        ) {
          return {
            field: fieldPath,
            constraintType: 'immutable',
            message:
              constraint.message ||
              `Field ${fieldPath} is immutable and cannot be updated`,
          };
        }
        break;

      case 'append-only':
        if (request.operation === 'update') {
          const currentValue = request.currentValue?.[fieldPath];
          const proposedValue = request.proposedChanges?.[fieldPath];

          if (Array.isArray(currentValue) && Array.isArray(proposedValue)) {
            // Check if we're only appending to the array
            if (proposedValue.length < currentValue.length) {
              return {
                field: fieldPath,
                constraintType: 'append-only',
                message:
                  constraint.message ||
                  `Field ${fieldPath} is append-only, cannot remove items`,
              };
            }
          }
        }
        break;

      case 'workflow':
        // Workflow constraints would need specific business logic
        // This is a placeholder for state transition validation
        break;
    }

    return null;
  }

  /**
   * Build human-readable denial reason
   */
  private buildDenialReason(
    hasPermissions: boolean,
    violations: ConstraintViolation[],
  ): string {
    const reasons: string[] = [];

    if (!hasPermissions) {
      reasons.push('Insufficient permissions');
    }

    if (violations.length > 0) {
      reasons.push(
        `Constraint violations: ${violations.map((v) => v.message).join(', ')}`,
      );
    }

    return reasons.join('; ');
  }
}

/**
 * Builder for field permission matrices
 */
export class FieldPermissionMatrixBuilder<P extends string> {
  private matrix: Partial<FieldPermissionMatrix<P>> = {
    fields: [],
  };

  static create<P extends string>(): FieldPermissionMatrixBuilder<P> {
    return new FieldPermissionMatrixBuilder<P>();
  }

  forEntity(entityType: string, domain: string): this {
    this.matrix.entityType = entityType;
    this.matrix.domain = domain;
    return this;
  }

  withDefaults(defaults: { [K in FieldOperation]?: P[] }): this {
    this.matrix.defaultPermissions = defaults;
    return this;
  }

  addField(field: string): FieldSpecBuilder<P> {
    return new FieldSpecBuilder<P>(this, field);
  }

  withMetadata(metadata: {
    version: string;
    description: string;
    lastUpdated?: string;
  }): this {
    this.matrix.metadata = {
      lastUpdated: new Date().toISOString(),
      ...metadata,
    };
    return this;
  }

  build(): FieldPermissionMatrix<P> {
    if (!this.matrix.entityType || !this.matrix.domain) {
      throw new Error('Entity type and domain are required');
    }

    return this.matrix as FieldPermissionMatrix<P>;
  }

  // Internal method for field builder
  _addFieldSpec(spec: FieldPermissionSpec<P>): this {
    this.matrix.fields?.push(spec);
    return this;
  }
}

/**
 * Builder for field specifications
 */
export class FieldSpecBuilder<P extends string> {
  private spec: Partial<FieldPermissionSpec<P>> = {};

  constructor(
    private parent: FieldPermissionMatrixBuilder<P>,
    field: string,
  ) {
    this.spec.field = field;
    this.spec.operations = [];
    this.spec.permissions = {};
  }

  requiring(operation: FieldOperation, ...permissions: P[]): this {
    if (!this.spec.operations?.includes(operation)) {
      this.spec.operations?.push(operation);
    }
    this.spec.permissions![operation] = permissions;
    return this;
  }

  withConstraint(constraint: FieldConstraint): this {
    if (!this.spec.constraints) {
      this.spec.constraints = [];
    }
    this.spec.constraints.push(constraint);
    return this;
  }

  description(desc: string): this {
    this.spec.description = desc;
    return this;
  }

  and(): FieldPermissionMatrixBuilder<P> {
    this.parent._addFieldSpec(this.spec as FieldPermissionSpec<P>);
    return this.parent;
  }
}
