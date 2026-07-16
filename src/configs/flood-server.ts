// ─────────────────────────────────────────────────────────────────────────────
// SERVER-ONLY flood upstream config (Vallaris / GISTDA).
//
// Imported ONLY by the /api/flood route handler — never by client code. It
// holds the upstream base URL and the observation-date → collection-ID map,
// plus the env validation for the API key. `NEXT_PUBLIC_*` must never appear
// here; nothing in this file may reach the browser bundle.
//
// Replacing Vallaris with another provider = reimplement the fetch inside
// src/app/api/flood/route.ts against this config (or swap this file), keeping
// the FloodApiResponse shape — the client only ever sees that shape.
// (No `server-only` marker package is installed; the guard is convention —
// only src/app/api/flood/route.ts may import this module.)
// ─────────────────────────────────────────────────────────────────────────────
import { FLOOD_DATASET_DATES } from "./flood-datasets";

export const VALLARIS = {
  baseUrl:
    process.env.VALLARIS_BASE_URL ??
    "https://vallaris.dragonfly.gistda.or.th/core/api/features/1.1",
  collectionId:
    process.env.VALLARIS_FLOOD_COLLECTION ?? "68ed51a9b630c46bc8bf4c1d",
  pageSize: 100,
} as const;

// Each observation date is an INDEPENDENT Vallaris collection. Keys must match
// the public registry (configs/flood-datasets.ts) — verified below in dev.
export const FLOOD_COLLECTION_BY_DATE: Record<string, string> = {
  "2025-12-18": "6943c92d1304b524df25e57d",
  "2025-10-19": "68f47ef0e608127bf78935bd",
  "2025-10-17": "68f22d8be8d7c1423b82f2fa",
  "2025-10-16": "68f1f85495e7df41088dca4e",
  "2025-10-15": "68f00c16eb83db3c46baa5f3",
  "2025-10-14": "68ee425aeb83db3c46b5803b",
  "2025-10-13": "68ed51a9b630c46bc8bf4c1d",
  "2024-10-12": "6780a6099e02acde959d1a28",
  "2024-10-10": "670e0d41460d838f0b6af4bf",
  "2024-10-07": "670e04f50094577ee282855f",
  "2024-10-05": "670e00405a1f3cdd42569414",
  "2024-10-02": "670dfe29460d838f0b6acd08",
  "2023-10-20": "66bb218790e33d5418ab6436",
  "2023-10-18": "66bb214e90e33d5418ab5492",
  "2023-10-12": "66bb208593e1785047ffa20d",
  "2023-10-11": "66bb1f528b7038347ff6012b",
  "2023-10-10": "66bb1f098b7038347ff5f185",
  "2022-10-20": "66dfd424aac53c8a2e519de7",
  "2022-10-18": "66dfd24e77d16758b4b3eb23",
  "2022-10-15": "66dfd0e3f8d72c8a5b566c1c",
  "2022-10-14": "66dfcffc77d16758b4b3e765",
  "2022-10-13": "66dfcf30f8d72c8a5b56699a",
};

/** Collection for a date (fallback: the default collection). */
export const collectionForDate = (date: string): string =>
  FLOOD_COLLECTION_BY_DATE[date] ?? VALLARIS.collectionId;

/**
 * Env/config sanity — runs once at module load (i.e. first /api/flood hit).
 * Missing key is NOT fatal (the route falls back to the dev fixture), but the
 * server log states clearly what is missing and what the consequence is,
 * instead of failing silently.
 */
let warned = false;
export function warnFloodServerConfigOnce(): void {
  if (warned) return;
  warned = true;
  if (!process.env.VALLARIS_API_KEY) {
    console.warn(
      "[api/flood] VALLARIS_API_KEY is not set — live Vallaris fetches are " +
        "disabled; responses fall back to the dev fixtures in src/data/flood/ " +
        "(empty for dates without a fixture). Set it in .env.local (see .env.example).",
    );
  }
  // Registry ↔ collection-map consistency (dev aid when adding a new date).
  const missing = FLOOD_DATASET_DATES.filter(
    (d) => !FLOOD_COLLECTION_BY_DATE[d],
  );
  if (missing.length) {
    console.warn(
      `[api/flood] dates registered in configs/flood-datasets.ts without a ` +
        `Vallaris collection mapping: ${missing.join(", ")} — these will use ` +
        `the default collection and may return empty.`,
    );
  }
}
