// API connection config (พาธ/baseURL). คู่กับ route.ts ที่เป็น route ภายในแอป
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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
  },
  boundaries: {
    byLevel: (level: "province" | "amphoe") => `/boundaries/${level}`,
    // Real Thailand province polygons — the exact open dataset the HTML uses.
    provincesGeoJson:
      "https://raw.githubusercontent.com/chingchai/OpenGISData-Thailand/master/provinces.geojson",
  },
} as const;
