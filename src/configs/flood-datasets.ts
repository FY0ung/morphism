// ─────────────────────────────────────────────────────────────────────────────
// Flood dataset REGISTRY — the single deterministic list of observation dates
// the app knows about. Everything that used to keep its own copy of this list
// (the chat's date resolver, the /api/flood route's collection map, the asset
// pipeline's default dates) derives from HERE, so adding a dataset is:
//
//   1. add the date below
//   2. map it to its Vallaris collection in configs/flood-server.ts
//   3. run `bun run build:flood <date>` to publish its assets
//
// Registry entries are PUBLIC-safe (dates only). Server-only details
// (collection IDs, API keys) live in configs/flood-server.ts. Per-dataset
// metadata that depends on the generated assets — bounds, feature count, area,
// version — is NOT duplicated here: it is served as `stats.json.gz` per key
// (see `DatasetMetadata` in types) and fetched lazily via getFloodStats().
// Asset URL builders (overview / detail / stats / PMTiles) live in
// configs/flood-data.ts and accept any key from this registry.
//
// Prompt aliases: an exact date resolves to itself; a month resolves to the
// LATEST snapshot in that month; a year resolves to the LATEST snapshot in
// that year (and, in PMTiles mode, to the `year-<CE>` annual cumulative key).
// A date/month with NO entry resolves to an explicit empty state — never a
// silent substitution of a different dataset.
// ─────────────────────────────────────────────────────────────────────────────

/** Every registered observation date (ISO YYYY-MM-DD), newest first. */
export const FLOOD_DATASET_DATES = [
  "2025-10-19", // Nakhon Ratchasima (Northeast)
  "2025-10-17", // Uttaradit (North)
  "2025-10-16", // Nakhon Ratchasima (Northeast)
  "2025-10-15", // Surin (Northeast)
  "2025-10-14", // Surin (Northeast)
  "2025-10-13",
  "2024-10-12", // Ayutthaya (Central)
  "2024-10-10", // Chiang Mai (North)
  "2024-10-07", // Ayutthaya (Central)
  "2024-10-05", // Ayutthaya (Central)
  "2024-10-02", // North + Northeast (wide extent)
  "2023-10-20", // Ayutthaya (Central)
  "2023-10-18", // Nakhon Ratchasima (Northeast)
  "2023-10-12", // Surin (Northeast)
  "2023-10-11", // Ayutthaya (Central)
  "2023-10-10", // Ayutthaya (Central)
  "2022-10-20", // Roi Et / Yasothon (Northeast)
  "2022-10-18", // Nonthaburi / Pathum Thani (Central)
  "2022-10-15", // Nakhon Ratchasima (Northeast)
  "2022-10-14",
  "2022-10-13", // Buriram (Northeast)
] as const;

/** Set view for O(1) availability checks. */
export const FLOOD_DATASET_DATE_SET: ReadonlySet<string> = new Set(
  FLOOD_DATASET_DATES,
);

/** True when an exact observation date is registered. */
export const floodDatasetAvailable = (date: string): boolean =>
  FLOOD_DATASET_DATE_SET.has(date);

/** DERIVED "YYYY-MM" → latest snapshot in that month (no hand-kept copy). */
export const FLOOD_DATASET_BY_MONTH: Readonly<Record<string, string>> = (() => {
  const byMonth: Record<string, string> = {};
  for (const d of FLOOD_DATASET_DATES) {
    const key = d.slice(0, 7);
    if (!byMonth[key] || d > byMonth[key]) byMonth[key] = d;
  }
  return byMonth;
})();

/** DERIVED "YYYY" (CE) → latest snapshot in that year. */
export const FLOOD_DATASET_BY_YEAR: Readonly<Record<string, string>> = (() => {
  const byYear: Record<string, string> = {};
  for (const d of FLOOD_DATASET_DATES) {
    const key = d.slice(0, 4);
    if (!byYear[key] || d > byYear[key]) byYear[key] = d;
  }
  return byYear;
})();

/** Latest CE year with real observations (derived — never hand-edited). */
export const FLOOD_LATEST_DATASET_YEAR = Number(
  Object.keys(FLOOD_DATASET_BY_YEAR).sort().at(-1),
);
