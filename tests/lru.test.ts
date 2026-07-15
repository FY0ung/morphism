// Bounded flood cache primitive (lib/lru).
import assert from "node:assert/strict";
import { LruCache } from "@/lib/lru";

export function run(): void {
  const c = new LruCache<string, number>(3);
  c.set("a", 1);
  c.set("b", 2);
  c.set("c", 3);
  assert.equal(c.size, 3);

  // Access refreshes recency → "a" survives the next eviction, "b" does not.
  assert.equal(c.get("a"), 1);
  c.set("d", 4);
  assert.equal(c.size, 3);
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("a"), 1);
  assert.equal(c.get("d"), 4);

  // Overwriting an existing key never evicts another entry.
  c.set("a", 10);
  assert.equal(c.size, 3);
  assert.equal(c.get("a"), 10);

  assert.throws(() => new LruCache(0));
}
