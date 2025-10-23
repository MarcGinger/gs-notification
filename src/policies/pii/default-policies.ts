// Default PII Policies - Universal baseline only
// Contains only truly universal PII keywords that apply across all domains

import { PIIKeywordPack } from '../../shared/services/compliance/pii-policy';

// Truly universal PII keywords only - no domain-specific assumptions
export const DEFAULT_BASELINE: PIIKeywordPack = {
  include: [
    'email',
    'phone',
    'mobile',
    'address',
    'street',
    'city',
    'postal',
    'contact',
    'iban',
    'swift',
    'card',
    'credit',
    'debit',
    'bank',
    'salary',
    'tax',
    'payment',
    'medical',
    'health',
    'diagnosis',
    'treatment',
    'patient',
    'race',
    'ethnicity',
    'religion',
    'political',
    'biometric',
    'fingerprint',
  ],
};
