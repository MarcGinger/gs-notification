# Shared Value Objects

This folder contains factory functions for creating consistent, validated value objects across all domains in the system.

## 🎯 **Purpose**

Instead of generating hundreds of lines of repetitive validation code for each value object, we use **factory functions** that generate value object classes with:

- ✅ **Consistent validation patterns**
- ✅ **Domain-agnostic reusability**
- ✅ **Minimal generated code**
- ✅ **Type safety**
- ✅ **Rich operations**

## 🏗️ **Architecture**

### **Before (Generated Boilerplate)**

```typescript
// 200+ lines of repetitive code per value object
export class ProductDescription {
  private static readonly TRIM = false as const;
  private static readonly CASE_TRANSFORM = 'none';
  // ... 190+ more lines of identical validation logic
}
```

### **After (Shared Factory)**

```typescript
// 20 lines per value object using shared factory
export const ProductDescription = createStringVO({
  name: 'ProductDescription',
  maxLength: 255,
  allowEmpty: true,
  errors: ProductErrors.Description,
});
```

## 📦 **Available Factories**

| Factory          | Purpose                | Example Use Cases                           |
| ---------------- | ---------------------- | ------------------------------------------- |
| `createStringVO` | String validation      | Names, descriptions, codes, addresses       |
| `createNumberVO` | Number validation      | Prices, quantities, percentages, IDs        |
| `createEnumVO`   | Enumeration validation | Categories, statuses, types                 |
| `createDateVO`   | Date validation        | Created dates, expiry dates, business dates |

## �️ **Adding Custom Validation Rules**

### **Method 1: Simple Custom Validation Function**

```typescript
import {
  createStringVO,
  validateNoProfanity,
} from 'src/shared/domain/value-objects';

export const ProductName = createStringVO({
  name: 'ProductName',
  maxLength: 100,
  customValidation: validateNoProfanity, // Add profanity filter
  errors: ProductErrors.Name,
});
```

### **Method 2: Chain Multiple Validation Rules**

```typescript
const validateProductDescription = (text: string) => {
  // Check profanity first
  let result = validateNoProfanity(text);
  if (!result.ok) return result;

  // Check for excessive capitalization
  const upperRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (upperRatio > 0.5 && text.length > 10) {
    return err(ProductErrors.EXCESSIVE_CAPS.with({ text, upperRatio }));
  }

  // Check for promotional spam
  const spamWords = ['buy now', 'limited time', 'guaranteed'];
  const lowerText = text.toLowerCase();
  for (const spam of spamWords) {
    if (lowerText.includes(spam)) {
      return err(ProductErrors.PROMOTIONAL_CONTENT.with({ text, spam }));
    }
  }

  return ok(text);
};

export const ProductDescription = createStringVO({
  name: 'ProductDescription',
  customValidation: validateProductDescription,
  errors: ProductErrors.Description,
});
```

### **Method 3: Content Validator Factory**

```typescript
import { createContentValidator } from 'src/shared/domain/value-objects/content-validation';

const businessNameValidator = createContentValidator({
  noProfanity: true,
  businessName: true,
  customRules: [
    (name) => validateBusinessNamingConventions(name),
    (name) => validateRegulatoryCompliance(name),
  ],
});

export const BusinessName = createStringVO({
  name: 'BusinessName',
  customValidation: businessNameValidator,
  errors: BusinessErrors.Name,
});
```

### **Common Custom Validation Patterns**

#### **Profanity Filter**

```typescript
// Built-in profanity validation
customValidation: validateNoProfanity;

// Or custom profanity list
customValidation: (text) => {
  const profanityWords = ['badword1', 'badword2'];
  const lower = text.toLowerCase();
  for (const word of profanityWords) {
    if (lower.includes(word)) {
      return err(YourErrors.CONTAINS_PROFANITY.with({ text, word }));
    }
  }
  return ok(text);
};
```

#### **Business Rules**

```typescript
// Banking compliance
customValidation: (name) => {
  const restrictedTerms = ['guaranteed', 'risk-free', 'no-loss'];
  const lower = name.toLowerCase();
  for (const term of restrictedTerms) {
    if (lower.includes(term)) {
      return err(BankingErrors.REGULATORY_VIOLATION.with({ name, term }));
    }
  }
  return ok(name);
};
```

#### **Format Rules**

```typescript
// URL slug validation
customValidation: (slug) => {
  if (slug.includes('--')) {
    return err(UrlErrors.CONSECUTIVE_HYPHENS.with({ slug }));
  }
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return err(UrlErrors.INVALID_HYPHEN_POSITION.with({ slug }));
  }
  return ok(slug);
};
```

## �🚀 **Usage Examples**

### **String Value Objects**

```typescript
import { createStringVO } from 'src/shared/domain/value-objects';

export const ProductName = createStringVO({
  name: 'ProductName',
  trim: true,
  maxLength: 100,
  allowEmpty: false,
  errors: {
    type: (v) => ProductErrors.NAME_INVALID_TYPE.with({ value: v }),
    empty: (v) => ProductErrors.NAME_EMPTY.with({ value: v }),
    tooLong: (v, max) => ProductErrors.NAME_TOO_LONG.with({ value: v, max }),
  },
});
```

### **Number Value Objects**

```typescript
import { createNumberVO } from 'src/shared/domain/value-objects';

export const ProductPrice = createNumberVO({
  name: 'ProductPrice',
  min: 0,
  allowDecimals: true,
  decimalPlaces: 2,
  allowNegative: false,
  errors: {
    type: (v) => ProductErrors.PRICE_INVALID_TYPE.with({ value: v }),
    tooSmall: (v, min) => ProductErrors.PRICE_TOO_SMALL.with({ value: v, min }),
    negativeNotAllowed: (v) => ProductErrors.PRICE_NEGATIVE.with({ value: v }),
  },
});
```

### **Enum Value Objects**

```typescript
import { createEnumVO } from 'src/shared/domain/value-objects';

export const ProductStatus = createEnumVO({
  name: 'ProductStatus',
  values: ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'] as const,
  caseSensitive: false,
  errors: {
    type: (v) => ProductErrors.STATUS_INVALID_TYPE.with({ value: v }),
    invalidValue: (v, valid) =>
      ProductErrors.STATUS_INVALID_VALUE.with({ value: v, valid }),
  },
});
```

### **Date Value Objects**

```typescript
import { createDateVO } from 'src/shared/domain/value-objects';

export const ProductExpiryDate = createDateVO({
  name: 'ProductExpiryDate',
  allowPast: false,
  businessDaysOnly: true,
  errors: {
    type: (v) => ProductErrors.EXPIRY_INVALID_TYPE.with({ value: v }),
    pastNotAllowed: (v) => ProductErrors.EXPIRY_IN_PAST.with({ value: v }),
    notBusinessDay: (v) =>
      ProductErrors.EXPIRY_NOT_BUSINESS_DAY.with({ value: v }),
  },
});
```

## 🎯 **Benefits for Templates**

### **For Code Generation**

1. **Smaller Templates**: Generate 20-line wrappers instead of 200-line classes
2. **Consistent API**: Same interface across all domains (banking, e-commerce, etc.)
3. **Easy Updates**: Fix bugs in one place, affects all value objects
4. **Domain Agnostic**: Same factories work for any business domain

### **For Domain Experts**

1. **Predictable**: All string VOs behave the same way
2. **Extensible**: Can add custom methods if needed
3. **Type Safe**: Full TypeScript support
4. **Rich Operations**: Built-in concat, slice, validation, etc.

## 🔧 **Configuration Options**

### **String Value Objects**

```typescript
interface StringVOConfig {
  name: string; // For error messages
  trim?: boolean; // Default: true
  caseTransform?: StringCase; // 'none' | 'lower' | 'upper'
  allowEmpty?: boolean; // Default: false
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  errors: ErrorFactory; // Domain-specific errors
}
```

### **Number Value Objects**

```typescript
interface NumberVOConfig {
  name: string;
  allowDecimals?: boolean; // Default: true
  min?: number;
  max?: number;
  decimalPlaces?: number;
  allowNegative?: boolean; // Default: true
  allowZero?: boolean; // Default: true
  errors: ErrorFactory;
}
```

## 📝 **Generated Code Pattern**

Your template generator should emit files like this:

```typescript
// contexts/bank/product/domain/value-objects/description.ts
import { createStringVO } from 'src/shared/domain/value-objects';
import { ProductErrors } from '../errors';

export const Description = createStringVO({
  name: 'Description',
  maxLength: 255,
  allowEmpty: true,
  trim: true,
  errors: ProductErrors.Description,
});

export type Description = InstanceType<typeof Description>;
```

## 🚀 **Next Steps**

1. **Update Templates**: Modify your code generator to use these factories
2. **Create Error Factories**: Standardize error creation patterns
3. **Add Custom Types**: Create additional factories as needed (URL, Email, etc.)
4. **Testing Utilities**: Add shared test helpers for value objects

This approach will dramatically reduce generated code size while maintaining full type safety and rich functionality! 🎯
