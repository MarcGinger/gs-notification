export const extractVariables = (
  data: Record<string, unknown>,
  defs: { name: string; path?: string }[],
) => {
  const result: Record<string, string> = {};
  for (const d of defs) {
    const path = d.path || d.name;
    const value = path
      .split('.')
      .reduce(
        (acc, k) => (acc == null ? acc : (acc as Record<string, unknown>)[k]),
        data as unknown,
      );
    if (value !== undefined && value !== null) {
      if (typeof value === 'object') {
        result[d.name] = '[object]';
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        result[d.name] = String(value);
      } else {
        result[d.name] = '[complex]';
      }
    }
  }
  return result;
};
