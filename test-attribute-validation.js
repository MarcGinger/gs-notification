// Test cases for attribute validation

// INCORRECT - Object/Record format (should fail validation)
const incorrectInput = {
  code: 'COUNTRY28',
  name: 'Countries123',
  attributes: {
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
  },
};

// CORRECT - Array format (should work)
const correctInput = {
  code: 'COUNTRY28',
  name: 'Countries123',
  attributes: [
    {
      code: 'email_validation',
      name: 'Email Format Validation',
      type: 'string',
      reference: false,
      reserved: false,
      unique: true,
      required: true,
      regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    },
    {
      code: 'dialing_code',
      name: 'Dialing Code Validation',
      type: 'string',
      reference: false,
      reserved: false,
      unique: false,
      required: false,
    },
  ],
};

console.log(
  'Incorrect format (object):',
  JSON.stringify(incorrectInput, null, 2),
);
console.log('\nCorrect format (array):', JSON.stringify(correctInput, null, 2));
