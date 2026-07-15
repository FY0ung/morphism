# Data adapters — replacing Morphism's datasets

Morphism's UI and map hooks consume **normalized internal contracts**, never raw
provider fields. To connect your own data you edit the *adapter/config layer*
only — the files in the "edit these" column. UI components, map hooks and the
scenario view should NOT need changes for a schema-compatible dataset.

| Dataset | Edit these | Do NOT edit |
| --- | --- | --- |
| Hospitals | `public/data/hospitals.geojson` (or `configs/endpoint.ts` → `hospitals.geojson`), `lib/api/hospitals.ts` | `sections/morphism/*`, `hooks/use-morphism-map.ts` |
| Flood datasets | `configs/flood-datasets.ts` (registry), `configs/flood-server.ts` (collections), `app/api/flood/route.ts` (provider fetch), assets via `scripts/build-flood-assets.ts` | `lib/api/flood.ts` callers, compare hooks, view |
| Admin boundaries | `configs/endpoint.ts` → `boundaries.adm` + `provincesGeoJson`, `lib/api/{boundaries,admin-boundaries}.ts` | `hooks/use-admin-*`, legend, zoom bands |
| Map style | `configs/map.ts` | everything else |
| Remote storage (R2) | `.env.local` (`NEXT_PUBLIC_FLOOD_*`, `R2_*`) — no code | everything |

## Required schemas (canonical contracts)

Defined in `src/types/` (see `types/dataset.ts` for the adapter-facing names).
All normalization lives in `src/lib/normalize.ts` + the `lib/api` services;
invalid features are skipped safely and reported in dev.

**HospitalFeature** — `Point` feature with properties:

```ts
{ name: string; h24?: boolean; province?: string }
```

`h24` must be `undefined` (not `false`) when your dataset has no 24-hour flag —
the filter is skipped for flagless datasets. `province` is a Thai province name
in any common form (`จ.…`/`จังหวัด…` prefixes and Bangkok aliases normalize via
`normalizeProvinceName`).

**AdministrativeBoundaryFeature** — ADM polygons with:

```ts
{ name: string; pro_code?: string; amp_code?: string }
```

Child levels (ADM2/ADM3) are joined to provinces by `pro_code` — provide stable
parent codes; names are display-only.

**FloodFeature / FloodApiResponse** — `/api/flood?date=YYYY-MM-DD` must return:

```ts
{ type: "FeatureCollection", features: Polygon|MultiPolygon[],
  date: string, numberMatched: number, numberReturned: number, partial: boolean }
```

**FloodOverview** — `{ coarse, medium, fine }` hex FeatureCollections
(generated for you by the pipeline; don't hand-write).

**DatasetMetadata** (`stats.json.gz`) — bbox, featureCount, areaKm2/areaRai,
tile zoom range, generatedAt (also pipeline-generated).

## Registering a new flood dataset

1. Add the observation date to `configs/flood-datasets.ts` (month/year aliases
   derive automatically; prompts in both CE and BE resolve to it).
2. Map the date → your provider collection in `configs/flood-server.ts`.
3. Run the pipeline: `bun run dev` + `bun run build:flood <date> year-<yyyy>`.
4. Done — the resolver, compare targets, route and asset script all read the
   same registry.

Unregistered dates resolve to an **explicit empty state** — never a silent
substitution of another date.

## Replacing Vallaris

Only `src/app/api/flood/route.ts` talks to the upstream. Reimplement
`buildForDate()` (fetch/paginate/filter/dedupe) against your provider, keep the
`FloodApiResponse` shape, keep the key server-side. The client (`lib/api/flood.ts`)
and everything above it are provider-agnostic.

## Replacing R2 / the asset CDN

Any static host that serves the generated `flood/<key>/…` objects works:
set `NEXT_PUBLIC_FLOOD_ASSET_BASE_URL` (and optionally
`NEXT_PUBLIC_FLOOD_PMTILES_BASE_URL`). Uploading is isolated in
`scripts/build-flood-assets.ts` (`makeClient()` — any S3-compatible API).
For local dev with no remote storage: `bun run build:flood -- --public` +
`NEXT_PUBLIC_FLOOD_PMTILES_BASE_URL=/flood-assets`.

## Generating overview + PMTiles assets

`scripts/build-flood-assets.ts` reads geometry from the app's own `/api/flood`
and produces per key: `detail.pmtiles`, `stats.json.gz`, `overview.json.gz`,
`detail.json.gz` (legacy). See README "Generating flood assets".

## Expected error / empty-state behavior

- Missing env (e.g. `VALLARIS_API_KEY`) → server logs a clear warning; the
  route falls back to dev fixtures in `src/data/flood/`, else an empty FC.
- Unavailable date → chat reports an explicit "no data for <date>" state; the
  previous valid map is kept (no fake geometry, no substituted date).
- Asset misses (PMTiles/overview) → automatic per-request fallback to the
  geojson flow; a failure never blanks the map.
- Invalid features in any source → skipped + dev-warned (`[normalize] …`),
  never a crash.
- Flagless `h24` → filter skipped; the limitation is documented in README.
