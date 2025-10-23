/**
 * Simple helper to race a promise against a timeout and always clear the timer.
 * Use this for clients that don't accept AbortSignal (TypeORM DataSource.query, ioredis, etc.).
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms = 1000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>(
        (_, rej) => (timer = setTimeout(() => rej(new Error('timeout')), ms)),
      ),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
