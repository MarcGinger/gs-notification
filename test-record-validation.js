// Test cases for Record vs Array validation

// INCORRECT - Array format (should now fail validation)
const incorrectArrayInput = {
  code: 'COUNTRY13',
  name: 'Countries',
  description:
    'ISO 3166 country codes and names for international address validation',
  enabled: true,
  attributes: [
    {
      code: 'email_validation',
      name: 'Email Format Validation',
      description: 'Validates email addresses using RFC 5322 standard format',
      type: 'string',
      reference: false,
      reserved: false,
      unique: true,
      uniqueError: 'This email address is already registered in the system',
      required: true,
      requiredError: 'Email address is required to create an account',
      regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      regexError: 'Please enter a valid email address (e.g., user@domain.com)',
    },
  ],
};

// CORRECT - Record/Object format (should work)
const correctRecordInput = {
  code: 'COUNTRY13',
  name: 'Countries',
  description:
    'ISO 3166 country codes and names for international address validation',
  enabled: true,
  attributes: {
    email_validation: {
      code: 'email_validation',
      name: 'Email Format Validation',
      description: 'Validates email addresses using RFC 5322 standard format',
      type: 'string',
      reference: false,
      reserved: false,
      unique: true,
      uniqueError: 'This email address is already registered in the system',
      required: true,
      requiredError: 'Email address is required to create an account',
      regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
      regexError: 'Please enter a valid email address (e.g., user@domain.com)',
    },
    dialing_code: {
      code: 'dialing_code',
      name: 'Dialing Code Validation',
      description: 'Validates international dialing codes',
      type: 'string',
      reference: false,
      reserved: false,
      unique: false,
      required: false,
    },
  },
};

console.log('INCORRECT format (array) - should throw validation error:');
console.log(JSON.stringify(incorrectArrayInput, null, 2));
console.log('\nCORRECT format (object/record) - should work:');
console.log(JSON.stringify(correctRecordInput, null, 2));
console.log('\nExpected behavior:');
console.log(
  '- Array input: ValidationError - "Attributes must be an object of AttributeRule objects, not an array"',
);
console.log('- Record input: Success - attributes saved correctly');
