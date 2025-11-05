export function maskKey(key: string) {
  if (!key) return '***';
  return key.length <= 4 ? '****' : `${key.slice(0, 2)}***${key.slice(-2)}`;
}
