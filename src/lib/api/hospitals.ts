import { endpoint } from "@/configs/endpoint";
import { normalizeH24, sanitizeFeatureCollection } from "@/lib/normalize";
import type { HospitalFC, HospitalProps, HospitalQuery } from "@/types";
import { ApiError } from "./client";

/**
 * โรงพยาบาล (ภาครัฐ) — โหลดจุดจริงจากชุดข้อมูลทะเบียนสถานพยาบาลรัฐ
 * (public/data/hospitals.geojson, 10k+ จุด). โยน ApiError เมื่อโหลดไม่สำเร็จ.
 * ทุก feature ถูก validate + normalize (ชื่อ/จังหวัด/ธง 24 ชม.) ก่อนถึง UI;
 * feature ที่ geometry เสียถูกข้ามอย่างปลอดภัย (รายงานใน dev).
 */
export async function getHospitals(
  query: HospitalQuery = {},
  signal?: AbortSignal,
): Promise<HospitalFC> {
  const res = await fetch(endpoint.hospitals.geojson, { signal });
  if (!res.ok) {
    throw new ApiError(res.status, `hospitals fetch failed: ${res.status}`);
  }
  const raw: unknown = await res.json();
  const { fc } = sanitizeFeatureCollection<HospitalProps>(
    raw,
    "hospitals",
    (p) => ({
      name: typeof p.name === "string" ? p.name : "",
      // `undefined` when the dataset carries no 24-hour information — callers
      // skip the h24 filter for flagless datasets instead of assuming false.
      h24: normalizeH24(p),
      province: typeof p.province === "string" ? p.province : undefined,
    }),
  );
  let features = fc.features;
  if (query.bbox) {
    const [w, s, e, n] = query.bbox;
    features = features.filter((f) => {
      const [lng, lat] =
        f.geometry.type === "Point" ? f.geometry.coordinates : [NaN, NaN];
      return lng >= w && lng <= e && lat >= s && lat <= n;
    });
  }
  return { type: "FeatureCollection", features };
}
