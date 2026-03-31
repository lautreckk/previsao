// ============================================================
// WINIFY DATA PROVIDER API - In-Memory Cache with TTL
// ============================================================

interface CacheEntry<T> {
  data: T;
  expires_at: number;
  fetched_at: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Get from cache or fetch fresh data
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<{ data: T; cached: boolean; fetched_at: string }> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expires_at > now) {
    return {
      data: existing.data,
      cached: true,
      fetched_at: new Date(existing.fetched_at).toISOString(),
    };
  }

  const data = await fetcher();
  store.set(key, { data, expires_at: now + ttlSeconds * 1000, fetched_at: now });

  // Cleanup old entries periodically
  if (store.size > 500) {
    for (const [k, v] of store) {
      if ((v as CacheEntry<unknown>).expires_at < now) store.delete(k);
    }
  }

  return {
    data,
    cached: false,
    fetched_at: new Date(now).toISOString(),
  };
}

/**
 * Invalidate a specific cache key
 */
export function invalidate(key: string) {
  store.delete(key);
}

/**
 * Invalidate all keys matching a prefix
 */
export function invalidatePrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
