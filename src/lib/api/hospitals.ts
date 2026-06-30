import { endpoint } from "@/configs/endpoint";
import type { Geometry, HospitalFC, HospitalProps, HospitalQuery } from "@/types";
import { ApiError } from "./client";

interface RawHospitalFeature {
  type: "Feature";
  geometry: Geometry;
  properties?: { name?: string; province?: string; h24?: boolean } | null;
}

/**
 * โรงพยาบาล (ภาครัฐ) — โหลดจุดจริงจากชุดข้อมูลทะเบียนสถานพยาบาลรัฐ
 * (public/data/hospitals.geojson, 10k+ จุด). โยน ApiError เมื่อโหลดไม่สำเร็จ.
 */
export async function getHospitals(
  query: HospitalQuery = {},
): Promise<HospitalFC> {
  const res = await fetch(endpoint.hospitals.geojson);
  if (!res.ok) {
    throw new ApiError(res.status, `hospitals fetch failed: ${res.status}`);
  }
  const raw = (await res.json()) as { features?: RawHospitalFeature[] };
  let features = (raw.features ?? []).map((f) => ({
    type: "Feature" as const,
    geometry: f.geometry,
    properties: {
      name: f.properties?.name ?? "",
      h24: Boolean(f.properties?.h24),
      province: f.properties?.province,
    } satisfies HospitalProps,
  }));
  // Optional client-side filters (the dataset has no 24/7 flag, so h24 is a no-op).
  if (query.bbox) {
    const [w, s, e, n] = query.bbox;
    features = features.filter((f) => {
      const [lng, lat] = f.geometry.type === "Point" ? f.geometry.coordinates : [NaN, NaN];
      return lng >= w && lng <= e && lat >= s && lat <= n;
    });
  }
  return { type: "FeatureCollection", features };
}
