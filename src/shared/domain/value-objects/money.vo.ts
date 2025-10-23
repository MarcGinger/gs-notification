import { Result, ok, err, DomainError } from '../../errors';

/**
 * Interface for defining money business rules/refinements
 */
export interface MoneyRefinement {
  /** Name for error reporting */
  name: string;
  /** Test function that returns true if the value is valid */
  test: (value: number) => boolean;
  /** Create error when test fails */
  createError: (value: number) => DomainError;
}

/**
 * Creates standardized error factory functions for money value objects
 * to reduce boilerplate code across implementations.
 *
 * @param baseError - The base domain error to extend (e.g., ProductErrors.INVALID_PRICE)
 * @param entityName - Human-readable name for the entity (e.g., 'Price', 'Balance')
 * @returns Object with standardized error factory functions
 *
 * @example
 * ```typescript
 * import { createMoneyVOErrors } from 'src/shared/domain/value-objects/money-vo';
 * import { ProductErrors } from '../errors/product.errors';
 *
 * export const ProductPrice = createMoneyVO({
 *   name: 'ProductPrice',
 *   currency: 'USD',
 *   min: 0,
 *   allowNegative: false,
 *   errors: createMoneyVOErrors(ProductErrors.INVALID_PRICE, 'Price'),
 * });
 * ```
 */
export function createMoneyVOErrors(
  baseError: DomainError,
  entityName: string,
) {
  return {
    type: (value: unknown) => ({
      ...baseError,
      detail: `${entityName} must be a number, received: ${typeof value}`,
      context: {
        value,
        operation: 'type_check',
        expected: 'number',
        received: typeof value,
      },
    }),

    notFinite: (value: number) => ({
      ...baseError,
      detail: `${entityName} must be a finite number, received: ${value}`,
      context: {
        value,
        operation: 'finite_check',
      },
    }),

    tooSmall: (value: number, min: number) => ({
      ...baseError,
      detail: `${entityName} must be at least ${min}, received: ${value}`,
      context: {
        value,
        min,
        operation: 'range_check',
      },
    }),

    tooLarge: (value: number, max: number) => ({
      ...baseError,
      detail: `${entityName} must be at most ${max}, received: ${value}`,
      context: {
        value,
        max,
        operation: 'range_check',
      },
    }),

    negativeNotAllowed: (value: number) => ({
      ...baseError,
      detail: `${entityName} cannot be negative, received: ${value}`,
      context: {
        value,
        operation: 'negative_check',
      },
    }),

    zeroNotAllowed: (value: number) => ({
      ...baseError,
      detail: `${entityName} cannot be zero`,
      context: {
        value,
        operation: 'zero_check',
      },
    }),

    currencyMismatch: (expected: string, actual: string) => ({
      ...baseError,
      detail: `${entityName} currency mismatch: expected ${expected}, received ${actual}`,
      context: {
        expected,
        actual,
        operation: 'currency_check',
      },
    }),

    invalidCurrency: (currency: string) => ({
      ...baseError,
      detail: `${entityName} has invalid currency: ${currency}`,
      context: {
        currency,
        operation: 'currency_validation',
      },
    }),

    divisionByZero: (value: number) => ({
      ...baseError,
      detail: `Cannot divide ${value} by zero`,
      context: {
        value,
        operation: 'division',
      },
    }),

    required: () => ({
      ...baseError,
      detail: `${entityName} is required`,
      context: {
        operation: 'required_validation',
      },
    }),

    custom: (value: number, reason: string) => ({
      ...baseError,
      detail: `${entityName} validation failed: ${reason}`,
      context: {
        value,
        reason,
        operation: 'custom_validation',
      },
    }),
  };
}

export type MoneyVOInstance = {
  readonly value: number;
  readonly currency: string;
  readonly isZero: boolean;
  readonly isPositive: boolean;
  readonly isNegative: boolean;
  readonly formatted: string;
  add(other: MoneyVOInstance): Result<MoneyVOInstance, DomainError>;
  subtract(other: MoneyVOInstance): Result<MoneyVOInstance, DomainError>;
  multiply(factor: number): Result<MoneyVOInstance, DomainError>;
  divide(divisor: number): Result<MoneyVOInstance, DomainError>;
  abs(): Result<MoneyVOInstance, DomainError>;
  negate(): Result<MoneyVOInstance, DomainError>;
  round(decimals?: number): Result<MoneyVOInstance, DomainError>;
  allocate(ratios: number[]): Result<MoneyVOInstance[], any>;
  equals(other: MoneyVOInstance): boolean;
  compare(other: MoneyVOInstance): -1 | 0 | 1;
  greaterThan(other: MoneyVOInstance): boolean;
  lessThan(other: MoneyVOInstance): boolean;
  toString(): string;
  toJSON(): { value: number; currency: string; type: string };
};

/**
 * Supported currency codes
 */
export type CurrencyCode =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'JPY'
  | 'CAD'
  | 'AUD'
  | 'CHF'
  | 'CNY';

/**
 * Currency configuration
 */
export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  decimalPlaces: number;
  symbolPosition: 'before' | 'after';
}

/**
 * Predefined currency configurations
 */
export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', decimalPlaces: 2, symbolPosition: 'before' },
  EUR: { code: 'EUR', symbol: '€', decimalPlaces: 2, symbolPosition: 'after' },
  GBP: { code: 'GBP', symbol: '£', decimalPlaces: 2, symbolPosition: 'before' },
  JPY: { code: 'JPY', symbol: '¥', decimalPlaces: 0, symbolPosition: 'before' },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    decimalPlaces: 2,
    symbolPosition: 'before',
  },
  CNY: { code: 'CNY', symbol: '¥', decimalPlaces: 2, symbolPosition: 'before' },
};

/**
 * Configuration interface for money value objects
 */
export interface MoneyVOConfig {
  /** Name of the value object (for error messages and serialization) */
  name: string;
  /** Currency code */
  currency: CurrencyCode;
  /** Minimum value (inclusive) */
  min?: number;
  /** Maximum value (inclusive) */
  max?: number;
  /** Allow negative amounts */
  allowNegative?: boolean;
  /** Allow zero amounts */
  allowZero?: boolean;
  /** Business rule refinements for domain validation */
  refinements?: MoneyRefinement[];
  /** Custom validation function for complex business rules */
  customValidation?: (value: number) => Result<void, DomainError>;
  /** Decimal precision for calculations */
  precision?: number;
  /** Scale (number of decimal places) */
  scale?: number;
  /** Rounding mode for calculations */
  rounding?: string;
  /** Whether the value is required */
  required?: boolean;
  /** Minimum value using template syntax */
  minValue?: number;
  /** Maximum value using template syntax */
  maxValue?: number;
  /** Domain-specific error factory functions */
  errors: {
    type: (value: unknown) => DomainError;
    notFinite: (value: number) => DomainError;
    tooSmall: (value: number, min: number) => DomainError;
    tooLarge: (value: number, max: number) => DomainError;
    negativeNotAllowed: (value: number) => DomainError;
    zeroNotAllowed: (value: number) => DomainError;
    currencyMismatch: (expected: string, actual: string) => DomainError;
    invalidCurrency: (currency: string) => DomainError;
    divisionByZero: (value: number) => DomainError;
    required?: () => DomainError;
  };
}

/**
 * Factory function to create money-based value objects
 * Provides consistent validation and operations for monetary values
 *
 * @param config Configuration object defining validation rules and error factories
 * @returns Value object class with validation and operations
 */
export function createMoneyVO(config: MoneyVOConfig) {
  // Configuration with defaults
  const ALLOW_NEGATIVE = config.allowNegative ?? true;
  const ALLOW_ZERO = config.allowZero ?? true;
  const CURRENCY_CONFIG = CURRENCIES[config.currency];

  if (!CURRENCY_CONFIG) {
    throw new Error(`Unsupported currency: ${config.currency}`);
  }

  /**
   * Format money value with currency symbol
   */
  const formatMoney = (value: number): string => {
    const formatted = value.toFixed(CURRENCY_CONFIG.decimalPlaces);
    if (CURRENCY_CONFIG.symbolPosition === 'before') {
      return `${CURRENCY_CONFIG.symbol}${formatted}`;
    } else {
      return `${formatted}${CURRENCY_CONFIG.symbol}`;
    }
  };

  /**
   * Validate money amount against configuration rules
   */
  const validate = (value: number): Result<number, DomainError> => {
    // Check if number is finite
    if (!Number.isFinite(value)) {
      return err(config.errors.notFinite(value));
    }

    // Check negative amounts
    if (!ALLOW_NEGATIVE && value < 0) {
      return err(config.errors.negativeNotAllowed(value));
    }

    // Check zero
    if (!ALLOW_ZERO && value === 0) {
      return err(config.errors.zeroNotAllowed(value));
    }

    // Check minimum value (prioritize new minValue over legacy min)
    const minVal = config.minValue ?? config.min;
    if (minVal !== undefined && value < minVal) {
      return err(config.errors.tooSmall(value, minVal));
    }

    // Check maximum value (prioritize new maxValue over legacy max)
    const maxVal = config.maxValue ?? config.max;
    if (maxVal !== undefined && value > maxVal) {
      return err(config.errors.tooLarge(value, maxVal));
    }

    // Process refinements (business rules)
    if (config.refinements) {
      for (const refinement of config.refinements) {
        if (!refinement.test(value)) {
          return err(refinement.createError(value));
        }
      }
    }

    // Process custom validation
    if (config.customValidation) {
      const customResult = config.customValidation(value);
      if (!customResult.ok) {
        return err(customResult.error);
      }
    }

    return ok(value);
  };

  /**
   * Money Value Object implementation
   * Generated dynamically based on configuration
   */
  return class MoneyVO {
    public readonly _value: number;
    public readonly _currency: string;

    protected constructor(value: number, currency: string) {
      this._value = value;
      this._currency = currency;
    }

    /**
     * Create value object from number with validation
     */
    static create(value?: number | null): Result<MoneyVO, DomainError> {
      // Check if value is required but not provided
      if (config.required && (value === undefined || value === null)) {
        return err(config.errors.required?.() || config.errors.type(value));
      }

      // If not required and no value provided, return error for type safety
      if (value === undefined || value === null) {
        return err(config.errors.type(value));
      }

      if (typeof value !== 'number') {
        return err(config.errors.type(value));
      }

      // Apply precision and scale if configured
      let processedValue = value;
      if (config.precision !== undefined && config.scale !== undefined) {
        // Round to specified scale
        const factor = Math.pow(10, config.scale);
        processedValue = Math.round(value * factor) / factor;
      }

      // Apply rounding if configured
      if (config.rounding) {
        switch (config.rounding) {
          case 'up':
            processedValue = Math.ceil(processedValue);
            break;
          case 'down':
            processedValue = Math.floor(processedValue);
            break;
          case 'half-up':
            processedValue = Math.round(processedValue);
            break;
          case 'half-down':
            processedValue =
              Math.sign(processedValue) *
              Math.floor(Math.abs(processedValue) + 0.5);
            break;
        }
      }

      const validationResult = validate(processedValue);

      if (!validationResult.ok) {
        return err(validationResult.error);
      }

      return ok(new MoneyVO(validationResult.value, config.currency));
    }

    /**
     * Create value object from unknown value (with type coercion)
     */
    static from(value: unknown): Result<MoneyVO, DomainError> {
      if (typeof value === 'number') {
        return this.create(value);
      }

      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed)) {
          return this.create(parsed);
        }
      }

      return err(config.errors.type(value));
    }

    // ==================== Accessors ====================

    /** Get the monetary value */
    get value(): number {
      return this._value;
    }

    /** Get the currency code */
    get currency(): string {
      return this._currency;
    }

    /** Check if amount is zero */
    get isZero(): boolean {
      return this._value === 0;
    }

    /** Check if amount is positive */
    get isPositive(): boolean {
      return this._value > 0;
    }

    /** Check if amount is negative */
    get isNegative(): boolean {
      return this._value < 0;
    }

    /** Get formatted string representation */
    get formatted(): string {
      return formatMoney(this._value);
    }

    // ==================== Operations ====================

    /**
     * Add another MoneyVO (re-validates result)
     */
    add(other: MoneyVO): Result<MoneyVO, DomainError> {
      if (other._currency !== this._currency) {
        return err(
          config.errors.currencyMismatch(this._currency, other._currency),
        );
      }
      const sum = this._value + other._value;
      return MoneyVO.create(sum);
    }

    /**
     * Subtract another MoneyVO (re-validates result)
     */
    subtract(other: MoneyVO): Result<MoneyVO, DomainError> {
      if (other._currency !== this._currency) {
        return err(
          config.errors.currencyMismatch(this._currency, other._currency),
        );
      }
      const difference = this._value - other._value;
      return MoneyVO.create(difference);
    }

    /**
     * Multiply by a factor (re-validates result)
     */
    multiply(factor: number): Result<MoneyVO, DomainError> {
      if (typeof factor !== 'number' || !Number.isFinite(factor)) {
        return err(config.errors.type(factor));
      }
      const product = this._value * factor;
      return MoneyVO.create(product);
    }

    /**
     * Divide by a divisor (re-validates result)
     */
    divide(divisor: number): Result<MoneyVO, DomainError> {
      if (typeof divisor !== 'number' || !Number.isFinite(divisor)) {
        return err(config.errors.type(divisor));
      }
      if (divisor === 0) {
        return err(config.errors.divisionByZero(this._value));
      }
      const quotient = this._value / divisor;
      return MoneyVO.create(quotient);
    }

    /**
     * Get absolute value (re-validates result)
     */
    abs(): Result<MoneyVO, DomainError> {
      const absolute = Math.abs(this._value);
      return MoneyVO.create(absolute);
    }

    /**
     * Negate the value (re-validates result)
     */
    negate(): Result<MoneyVO, DomainError> {
      const negated = -this._value;
      return MoneyVO.create(negated);
    }

    /**
     * Round to specified decimal places (re-validates result)
     */
    round(decimals?: number): Result<MoneyVO, DomainError> {
      const rounded = Number(
        this._value.toFixed(decimals ?? CURRENCY_CONFIG.decimalPlaces),
      );
      return MoneyVO.create(rounded);
    }

    /**
     * Allocate money across multiple ratios (for splitting payments)
     */
    allocate(ratios: number[]): Result<MoneyVO[], any> {
      if (!Array.isArray(ratios) || ratios.length === 0) {
        return err(config.errors.type(ratios));
      }

      const totalRatio = ratios.reduce((sum, ratio) => sum + ratio, 0);
      if (totalRatio === 0) {
        return err(config.errors.divisionByZero(this._value));
      }

      const results: MoneyVO[] = [];
      let remaining = this._value;

      for (let i = 0; i < ratios.length; i++) {
        const isLast = i === ratios.length - 1;
        let amount: number;

        if (isLast) {
          // Last allocation gets the remainder to avoid rounding errors
          amount = remaining;
        } else {
          amount =
            Math.round(((this._value * ratios[i]) / totalRatio) * 100) / 100;
          remaining -= amount;
        }

        const result = MoneyVO.create(amount);
        if (!result.ok) {
          return err(result.error);
        }
        results.push(result.value);
      }

      return ok(results);
    }

    // ==================== Comparison ====================

    /**
     * Check equality with another MoneyVO
     */
    equals(other: MoneyVO): boolean {
      return this._value === other._value && this._currency === other._currency;
    }

    /**
     * Compare with another MoneyVO
     */
    compare(other: MoneyVO): -1 | 0 | 1 {
      if (this._currency !== other._currency) {
        throw new Error(
          `Cannot compare different currencies: ${this._currency} vs ${other._currency}`,
        );
      }
      if (this._value < other._value) return -1;
      if (this._value > other._value) return 1;
      return 0;
    }

    /**
     * Check if greater than another MoneyVO
     */
    greaterThan(other: MoneyVO): boolean {
      if (this._currency !== other._currency) {
        throw new Error(
          `Cannot compare different currencies: ${this._currency} vs ${other._currency}`,
        );
      }
      return this._value > other._value;
    }

    /**
     * Check if less than another MoneyVO
     */
    lessThan(other: MoneyVO): boolean {
      if (this._currency !== other._currency) {
        throw new Error(
          `Cannot compare different currencies: ${this._currency} vs ${other._currency}`,
        );
      }
      return this._value < other._value;
    }

    // ==================== Serialization ====================

    /**
     * Convert to string representation
     */
    toString(): string {
      return this.formatted;
    }

    /**
     * Convert to JSON representation
     */
    toJSON(): { value: number; currency: string; type: string } {
      return {
        value: this._value,
        currency: this._currency,
        type: config.name,
      };
    }
  };
}
