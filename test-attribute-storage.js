const testInput = {
  "code": "COUNTRY26",
  "name": "Countries", 
  "description": "ISO 3166 country codes and names for international address validation",
  "enabled": true,
  "attributes": [
    {
      "code": "email_validation_123",
      "name": "Email Format Validation",
      "description": "Validates email addresses using RFC 5322 standard format",
      "type": "string",
      "reference": false,
      "reserved": false,
      "unique": true,
      "uniqueError": "This email address is already registered in the system",
      "required": true,
      "requiredError": "Email address is required to create an account",
      "regex": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      "regexError": "Please enter a valid email address (e.g., user@domain.com)"
    }
  ]
};

console.log('Test input:');
console.log(JSON.stringify(testInput, null, 2));

console.log('\nExpected to save all attribute fields, not empty objects');