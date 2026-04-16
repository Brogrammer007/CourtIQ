// Tiny in-memory TTL cache. Good enough for a single-instance proxy.
const store = new Map();

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlSeconds) {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function cached(key, ttlSeconds, loader) {
  const hit = cacheGet(key);
  if (hit !== null) return hit;
  const value = await loader();
  cacheSet(key, value, ttlSeconds);
  return value;
}
