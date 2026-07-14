// API connection config (พาธ/baseURL). คู่กับ route.ts ที่เป็น route ภายในแอป
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Public CDN base for pre-generated flood assets (Cloudflare R2). Browser-safe:
// the bucket is public and this is a plain URL (NOT a secret — unlike the
// Vallaris key/URL which stay server-side in the /api/flood route). Objects are
// gzip-compressed and the browser decompresses them (see lib/api/flood.ts);
// r2.dev does not send Content-Encoding, so the key ends in `.json.gz`.
const FLOOD_ASSET_BASE = (
  process.env.NEXT_PUBLIC_FLOOD_ASSET_BASE_URL ?? ""
).replace(/\/+$/, "");

export const endpoint = {
  user: {
    list: "/users",
    detail: (id: string) => `/users/${id}`,
  },
  // ── Morphism (AI Map Assistant) — geospatial resources ──
  // ทุก path มาจากที่นี่ที่เดียว · service ใน lib/api เรียกผ่าน apiClient
  hospitals: {
    list: "/hospitals", // ?bbox=&h24=
    // Real public-hospital registry (10k+ points) served from /public.
    geojson: "/data/hospitals.geojson",
  },
  flood: {
    byYear: (year: number) => `/flood/${year}`,
    // Client → same-origin server proxy (keeps the upstream URL + API key off the
    // browser and avoids the upstream CORS block). Always call with a ?date=.
    // NOTE: the upstream Vallaris URL/collection live SERVER-SIDE only (in the
    // /api/flood route handler), never here — this config is bundled to the
    // browser, so no upstream URL or key may appear in it.
    proxy: "/api/flood",
    byDate: (date: string) => `/api/flood?date=${encodeURIComponent(date)}`,
    // Static pre-generated assets on the R2 CDN (gzip; browser decompresses).
    // Empty base ⇒ not configured ⇒ client falls back to the /api/flood proxy.
    assetBase: FLOOD_ASSET_BASE,
    assetDetail: (date: string) =>
      `${FLOOD_ASSET_BASE}/flood/${encodeURIComponent(date)}/detail.json.gz`,
    assetOverview: (date: string) =>
      `${FLOOD_ASSET_BASE}/flood/${encodeURIComponent(date)}/overview.json.gz`,
  },
  boundaries: {
    byLevel: (level: "province" | "amphoe") => `/boundaries/${level}`,
    // Real Thailand admin polygons — the EXACT open datasets the HTML uses
    // (chingchai/OpenGISData-Thailand). Lazy-loaded by zoom; never committed to
    // the repo (fetched at runtime; served with permissive CORS).
    provincesGeoJson:
      "https://raw.githubusercontent.com/chingchai/OpenGISData-Thailand/master/provinces.geojson",
    // ADM level → source URL (ADM1 kept above as provincesGeoJson).
    adm: {
      ADM1:
        "https://raw.githubusercontent.com/chingchai/OpenGISData-Thailand/master/provinces.geojson",
      ADM2:
        "https://raw.githubusercontent.com/chingchai/OpenGISData-Thailand/master/districts.geojson",
      ADM3:
        "https://raw.githubusercontent.com/chingchai/OpenGISData-Thailand/master/subdistricts.geojson",
    } as Record<"ADM1" | "ADM2" | "ADM3", string>,
  },
} as const;
