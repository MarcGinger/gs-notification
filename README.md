# Domain Review - Value Object Standardization Project

## Overview

This project implements a comprehensive domain-driven design (DDD) architecture with standardized value objects, focusing on banking product configuration domains. The codebase demonstrates enterprise-level patterns including Event Sourcing, CQRS, and multi-store architectures.

## 🎯 Value Object Standardization

This project has undergone extensive value object standardization across 5 completed phases:

- **Phase 1**: Critical Fixes ✅
- **Phase 2**: Interface Standardization ✅
- **Phase 3**: Method Standardization ✅
- **Phase 4**: Validation Flow Standardization ✅
- **Phase 5**: Export/Import Consistency ✅
- **Phase 6**: Documentation and Testing 🔄 _(In Progress)_

### Standardized Value Objects

The project includes 15+ standardized value objects with consistent interfaces:

| Value Object   | Purpose             | Key Features                                 |
| -------------- | ------------------- | -------------------------------------------- |
| `StringVO`     | Text validation     | Length limits, case transformation, trimming |
| `IntegerVO`    | Numeric validation  | Range validation, step constraints           |
| `BooleanVO`    | Boolean logic       | Truth validation with context                |
| `DateVO`       | Date handling       | Range validation, business day logic         |
| `DateTimeVO`   | DateTime operations | Timezone awareness, validation               |
| `TimeVO`       | Time operations     | Format validation, range checks              |
| `DurationVO`   | Time spans          | Parsing, validation, comparisons             |
| `DecimalVO`    | Precise numbers     | Currency calculations, precision control     |
| `MoneyVO`      | Financial amounts   | Multi-currency support, arithmetic           |
| `UuidVO`       | Unique identifiers  | Format validation, generation                |
| `EnumVO`       | Enumeration types   | State transitions, validation                |
| `CollectionVO` | Collections         | Business methods, validation                 |
| `RecordVO`     | Key-value maps      | Schema validation, operations                |
| `BigIntVO`     | Large integers      | Arbitrary precision numbers                  |

## 🏗️ Architecture

### Domain Structure

```
src/
├── shared/
│   └── domain/
│       └── value-objects/          # Standardized VOs
│           ├── index.ts            # Barrel exports
│           ├── string.vo.ts        # String value object
│           ├── integer.vo.ts       # Integer value object
│           └── ...                 # Other VOs
├── contexts/
│   └── bank/
│       └── product-config/         # Banking domain
│           ├── rail/               # Rail product context
│           ├── base/               # Base product context
│           └── shared/             # Shared banking VOs
```

### Event Sourcing Architecture

- **EventStore**: Primary data store using event streams
- **Read Models**: Projected views for queries
- **CQRS**: Separate command/query responsibilities
- **Multi-Store**: Redis caching, SQL analytics

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- TypeScript 5+
- NestJS framework
- Docker for infrastructure

### Installation

```bash
npm install
```

### Development

```bash
# Development mode
npm run start:dev

# Run tests
npm run test

# Run linting
npm run lint
```

## 📖 Value Object Usage

### Creating Value Objects

All value objects follow a consistent factory pattern:

```typescript
import { createStringVO } from 'src/shared/domain/value-objects';

// Create a product name VO
const ProductName = createStringVO({
  name: 'ProductName',
  maxLength: 100,
  trim: true,
  errors: ProductErrors.Name,
});

// Usage
const nameResult = ProductName.create('Premium Account');
if (nameResult.isSuccess()) {
  const name = nameResult.getValue();
  console.log(name.value); // "Premium Account"
}
```

### Error Handling Pattern

```typescript
// All VOs return Result<T, Error> for type-safe error handling
const result = ProductName.create('');
if (result.isFailure()) {
  console.error(result.getError().message);
}
```

### Validation Configuration

```typescript
const AccountNumber = createStringVO({
  name: 'AccountNumber',
  minLength: 8,
  maxLength: 12,
  pattern: /^[A-Z0-9]+$/,
  transform: 'uppercase',
  errors: AccountErrors.Number,
});
```

### Business Logic Integration

```typescript
const TransactionAmount = createMoneyVO({
  name: 'TransactionAmount',
  currency: 'USD',
  minValue: 0.01,
  maxValue: 10000.0,
  errors: TransactionErrors.Amount,
});

// Usage in domain entities
class BankAccount {
  withdraw(amount: MoneyVOInstance): Result<void, DomainError> {
    const amountResult = TransactionAmount.create(amount);
    if (amountResult.isFailure()) {
      return Result.fail(amountResult.getError());
    }
    // Business logic...
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/domain_review
REDIS_URL=redis://localhost:6379

# EventStore
EVENTSTORE_CONNECTION_STRING=esdb://admin:changeit@localhost:2113

# Application
PORT=3000
NODE_ENV=development
```

### Docker Setup

```bash
# Start infrastructure
docker-compose up -d

# Start application
npm run start:dev
```

## 📚 Domain Patterns

### Aggregate Pattern

```typescript
// Example aggregate with standardized VOs
export class ProductAggregate {
  private constructor(
    private readonly id: UuidVOInstance,
    private readonly name: StringVOInstance,
    private readonly status: EnumVOInstance,
    private readonly pricing: MoneyVOInstance,
  ) {}

  static create(
    data: CreateProductData,
  ): Result<ProductAggregate, DomainError> {
    // Use standardized VOs for validation
    const idResult = ProductId.create(data.id);
    const nameResult = ProductName.create(data.name);

    if (Result.combine([idResult, nameResult]).isFailure()) {
      return Result.fail(/* combined errors */);
    }

    return Result.ok(
      new ProductAggregate(
        idResult.getValue(),
        nameResult.getValue(),
        // ...
      ),
    );
  }
}
```

### Event Sourcing Integration

```typescript
// Domain events with VO integration
export class ProductCreatedEvent extends DomainEvent {
  constructor(
    public readonly productId: UuidVOInstance,
    public readonly name: StringVOInstance,
    public readonly pricing: MoneyVOInstance,
  ) {
    super();
  }
}
```

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
npm run test

# Run with coverage
npm run test:cov

# Watch mode
npm run test:watch
```

### Value Object Testing

```typescript
describe('StringVO', () => {
  it('should create valid string VO', () => {
    const StringTest = createStringVO({
      name: 'TestString',
      maxLength: 10,
    });

    const result = StringTest.create('valid');
    expect(result.isSuccess()).toBe(true);
    expect(result.getValue().value).toBe('valid');
  });

  it('should reject invalid input', () => {
    const result = StringTest.create('toolongstring');
    expect(result.isFailure()).toBe(true);
  });
});
```

## 📋 Migration Guide

### Migrating from Legacy VOs

1. **Update Imports**:

```typescript
// Before
import { StringValueObject } from './old-path';

// After
import { createStringVO } from 'src/shared/domain/value-objects';
const StringVO = createStringVO({ name: 'String' /* config */ });
```

2. **Update Creation Pattern**:

```typescript
// Before
const vo = new StringValueObject('value');

// After
const result = StringVO.create('value');
const vo = result.getValue();
```

3. **Update Error Handling**:

```typescript
// Before
try {
  const vo = new StringValueObject(invalidValue);
} catch (error) {
  // Handle error
}

// After
const result = StringVO.create(invalidValue);
if (result.isFailure()) {
  const error = result.getError();
  // Handle error
}
```

## 🤝 Contributing

### Development Standards

1. **All VOs must use factory pattern**
2. **Consistent error handling with Result<T, E>**
3. **Comprehensive type exports**
4. **Named exports only (no default exports)**
5. **Full test coverage for new VOs**

### Adding New Value Objects

1. Create VO file following existing patterns
2. Add comprehensive tests
3. Export from `index.ts`
4. Update documentation
5. Add to domain-specific contexts as needed

### Code Review Checklist

- [ ] Factory pattern implementation
- [ ] Result<T, E> error handling
- [ ] Comprehensive validation
- [ ] Type exports included
- [ ] Tests with 90%+ coverage
- [ ] Documentation updated
- [ ] Barrel exports updated

## 🔍 Monitoring & Observability

### Health Checks

The application includes comprehensive health checks:

- Database connectivity
- Redis availability
- EventStore connection
- Domain service health

### Metrics

Key metrics tracked:

- VO creation success/failure rates
- Validation performance
- Aggregate operation latency
- Event processing throughput

### Logging

Structured logging with:

- Request correlation IDs
- Domain context
- Error classification
- Performance metrics

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions and support:

1. Check existing documentation
2. Review test examples
3. Check domain implementation patterns
4. Create detailed issue reports

---

_This README reflects the current state after Phase 5 completion (Export/Import Consistency) with Phase 6 (Documentation and Testing) in progress._
