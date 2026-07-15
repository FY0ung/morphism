# Morphism — AI Map Assistant (GEOINT)

Chat-driven map workspace for exploring Thai geospatial data in plain language:
flood extents per observation date (GISTDA/Vallaris), 10k+ public hospitals,
administrative boundaries (region → province → district → subdistrict), spatial
analysis (5 km buffers, province/region aggregation) and a swipe comparison of
two flood periods. Built on MapLibre with a deterministic scenario engine —
follow `AGENTS.md` and `ARCHITECTURE.md` for all conventions.

## Stack

- Next.js 16 (App Router) + React 19 + React Compiler
- TypeScript (strict) · Tailwind CSS v4 (design tokens via `@theme`)
- MapLibre GL + PMTiles · next-themes · i18next (TH/EN) · dayjs
- Package manager: **Bun**

## Getting started

```bash
bun install
cp .env.example .env.local   # then fill in the values (see below)
bun run dev                  # http://localhost:3000
```

Validation:

```bash
bun run typecheck          # app code (tsc --noEmit)
bun run typecheck:scripts  # data-pipeline scripts
bun run lint
bun run build
```

## Environment variables

Every variable is documented inline in [`.env.example`](.env.example). Summary:

| Variable | Side | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | client | Base URL for `lib/api/client.ts` (empty = same-origin) |
| `NEXT_PUBLIC_FLOOD_DATA_MODE` | client | `pmtiles` (default) or `geojson` fallback flow |
| `NEXT_PUBLIC_FLOOD_ASSET_BASE_URL` | client | Public R2 base for pre-generated flood assets |
| `NEXT_PUBLIC_FLOOD_PMTILES_BASE_URL` | client | Optional base for PMTiles-era artifacts (e.g. `/flood-assets` in dev) |
| `VALLARIS_API_KEY` | server | Vallaris (GISTDA) key — used only by the `/api/flood` route handler |
| `VALLARIS_BASE_URL`, `VALLARIS_FLOOD_COLLECTION` | server | Optional upstream overrides |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME` | script | Cloudflare R2 upload for `build:flood` |
| `GENERATE_SOURCE_BASE` | script | Where the asset script reads `/api/flood` from (default `http://localhost:3000`) |

No `VALLARIS_API_KEY` → `/api/flood` serves the small dev fixture in
`src/data/flood/` (currently `2025-10-13` only) so the app still runs.

## Data sources & flood data modes

| Layer | Source | Delivery |
| --- | --- | --- |
| Flood extents | Vallaris (GISTDA) collections, one per observation date | see modes below |
| Hospitals | `public/data/hospitals.geojson` (10k+ points, tracked in git) | static file |
| Admin boundaries | [chingchai/OpenGISData-Thailand](https://github.com/chingchai/OpenGISData-Thailand) (ADM1/2/3) | fetched lazily by zoom, cached in-session |
| Basemap | CARTO dark-matter / positron vector styles | follows the UI theme |

**Flood delivery modes** (`NEXT_PUBLIC_FLOOD_DATA_MODE`):

- **`pmtiles` (default)** — the map renders `flood/<key>/detail.pmtiles` as a
  MapLibre vector source (only visible tiles are range-fetched from R2) and
  reads bbox / flooded area / totals from the precomputed `stats.json.gz`. The
  browser never downloads the complete GeoJSON. Dataset keys are a date
  (`2025-10-13`) or an annual cumulative (`year-2025`).
- **`geojson`** — the previous flow: full FeatureCollection from the CDN
  (`detail.json.gz`) or the `/api/flood` proxy, hex LODs derived client-side.
  Also the automatic per-request fallback whenever a PMTiles asset is missing.

The `/api/flood` route handler is the only place that talks to Vallaris: it
paginates with bounded concurrency, filters to the requested date, dedupes and
returns one FeatureCollection. Upstream URL + key stay server-side. Available
observation dates ↔ collection IDs are currently mapped in
`src/app/api/flood/route.ts` (`FLOOD_COLLECTION_BY_DATE`) and mirrored by the
query resolver in `src/sections/morphism/const.tsx` (`FLOOD_SNAPSHOTS`) — keep
both in sync when adding a date.

## Generating flood assets (R2 / PMTiles)

`scripts/build-flood-assets.ts` produces, per dataset key:
`detail.pmtiles`, `stats.json.gz`, `overview.json.gz` (+ legacy
`detail.json.gz`), writes them to `dist/flood/` and uploads to R2 (Bun's
built-in S3 client). It reads geometry from the app's own `/api/flood`, so
start the dev server first.

```bash
bun run dev                          # in another terminal
bun run build:flood                  # all default dates + year datasets
bun run build:flood 2025-10-13 year-2025   # only these keys
bun run build:flood:dry              # generate locally, no upload
bun run build:flood -- --public      # also copy into public/flood-assets (dev)
```

For local dev without R2, run with `--public` and set
`NEXT_PUBLIC_FLOOD_PMTILES_BASE_URL=/flood-assets`.

## Project layout

See `ARCHITECTURE.md` (canonical). Feature code lives in
`src/sections/morphism/` (view + chat/workspace layout + scenario resolver);
map lifecycle in `src/hooks/use-morphism-map.ts` and sibling hooks; all
backend access in `src/lib/api/`; endpoints in `src/configs/endpoint.ts`.

## Known limitations

- The public hospital dataset has **no 24-hour flag** — "24-hour" queries
  currently show all matching hospitals (`h24` filter is a documented no-op).
- Province/region aggregate counts in chat scenarios come from a static table
  ported from the HTML reference, not from the live hospital dataset.
- The intent matcher is deterministic keyword matching (TH/EN), tuned to the
  bundled Thai datasets; swapping datasets requires editing
  `src/sections/morphism/const.tsx` and the flood date/collection maps.
- Admin boundaries are fetched from a third-party GitHub repo (`master`,
  unpinned); ADM3 is a large file only loaded at zoom ≥ 12.
- `next build` needs network access to Google Fonts (Anuphan).
