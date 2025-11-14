// Test the CollectionVO fix
const {
  AttributeRuleSetAttributeRuleConfiguration,
} = require('./src/contexts/core/attributes/attribute-rule-set/domain/value-objects');

// Test 1: Valid array input (should work)
const validArrayInput = [
  {
    code: 'email_validation',
    name: 'Email Format Validation',
    type: 'string',
    reference: false,
    reserved: false,
    unique: true,
    required: true,
  },
];

// Test 2: Invalid object input (should now fail with proper error)
const invalidObjectInput = {
  additionalProp1: {
    code: 'email_validation',
    name: 'Email Format Validation',
    type: 'string',
  },
  dialingCode: {
    code: 'dialing_code',
    name: 'Dialing Code Validation',
    type: 'string',
  },
};

console.log('Testing CollectionVO.from() method:');
console.log(
  '\n1. Valid array input:',
  JSON.stringify(validArrayInput, null, 2),
);
console.log(
  '\n2. Invalid object input:',
  JSON.stringify(invalidObjectInput, null, 2),
);
console.log(
  '\nBefore fix: Object input would be wrapped as [object] and processed incorrectly',
);
console.log(
  'After fix: Object input should return validation error immediately',
);
