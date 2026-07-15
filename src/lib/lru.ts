/**
 * Minimal deterministic LRU cache built on Map's insertion order — no timers,
 * no weak refs, no dependency. `get` refreshes recency; `set` evicts the
 * least-recently-used entry once `maxEntries` is exceeded.
 *
 * Used to bound the flood dataset caches (client `lib/api/flood.ts` + the
 * `/api/flood` route): full FeatureCollections can reach tens of MB per date,
 * so an unbounded Map grows for the whole session/process lifetime. Eviction
 * only drops the cache's own reference — data already handed to callers (e.g.
 * an open compare session's detail indexes) keeps working untouched.
 */
export class LruCache<K, V> {
  private map = new Map<K, V>();

  constructor(private readonly maxEntries: number) {
    if (maxEntries < 1) throw new Error("LruCache: maxEntries must be ≥ 1");
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key) as V;
    // Re-insert to mark as most-recently-used (Map preserves insertion order).
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }
  }

  delete(key: K): void {
    this.map.delete(key);
  }

  get size(): number {
    return this.map.size;
  }
}
