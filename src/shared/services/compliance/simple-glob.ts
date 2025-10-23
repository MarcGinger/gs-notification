// Simple Glob Pattern Matcher for PII path-aware rules
// Supports * and [*] wildcards for flexible field matching

/**
 * Convert a glob pattern to RegExp for path matching
 * Supports:
 * - * for any segment (non-dot, non-bracket)
 * - [*] for array index wildcard
 * - ** for deep wildcard (any depth) - optional future extension
 */
function globToRegExp(glob: string): RegExp {
  // Escape regex special characters, then replace wildcards
  const escaped = glob
    .replace(/[-\/\\^$+?.()|[\]{}]/g, '\\$&')
    .replace(/\*\*/g, '.*') // optional: deep wildcard
    .replace(/\[\*\]/g, '\\[[^\\]]+\\]') // array index wildcard [*] -> [123]
    .replace(/\*/g, '[^.\\[\\]]+'); // segment wildcard * -> anything except . [ ]

  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Check if a field path matches a glob pattern
 * @param path - The field path to test (e.g., "person.name", "people[0].name")
 * @param pattern - The glob pattern (e.g., "person.name", "people[*].name")
 * @returns true if path matches pattern
 */
export function pathMatches(path: string, pattern: string): boolean {
  return globToRegExp(pattern).test(path);
}

// Example usage:
// pathMatches("person.name", "person.name") → true
// pathMatches("identityType.name", "person.name") → false
// pathMatches("people[0].name", "people[*].name") → true
// pathMatches("users[123].profile.email", "users[*].profile.email") → true
