import { endpoint } from "@/configs/endpoint";
import { emptyFC } from "@/types";
import type {
  BoundaryFC,
  BoundaryLevel,
  Geometry,
  ProvinceBoundaryFC,
} from "@/types";
import { ApiError } from "./client";

/**
 * ขอบเขตการปกครอง (จังหวัด / อำเภอ) — placeholder จนกว่าจะมี backend จริง.
 */
export async function getBoundaries(
  level: BoundaryLevel,
): Promise<BoundaryFC> {
  void endpoint.boundaries.byLevel(level);
  return emptyFC<BoundaryFC["features"][number]["properties"]>();
}

// Property keys that hold the Thai province name across common TH datasets.
const NAME_KEYS = [
  "pro_th",
  "name_th",
  "PROV_NAMT",
  "ADM1_TH",
  "NAME_1",
  "name",
  "pro_en",
] as const;

interface RawFeature {
  type: "Feature";
  geometry: Geometry;
  properties?: Record<string, unknown> | null;
}

/**
 * ดึงโพลิกอนจังหวัดจริงจากชุดข้อมูลเปิด (แหล่งเดียวกับ HTML reference) แล้ว
 * normalize property ให้เหลือ `name` (ชื่อจังหวัดภาษาไทย) เพื่อให้ join กับ
 * ตารางจำนวนได้ · โยน ApiError เมื่อโหลดไม่สำเร็จ (ไม่สร้าง polygon ปลอม).
 */
export async function getProvinceBoundaries(): Promise<ProvinceBoundaryFC> {
  // Plain GET (no JSON content-type) so it stays a simple CORS request.
  const res = await fetch(endpoint.boundaries.provincesGeoJson);
  if (!res.ok) {
    throw new ApiError(res.status, `province boundaries fetch failed: ${res.status}`);
  }
  const raw = (await res.json()) as { features?: RawFeature[] };
  const features = (raw.features ?? []).map((f) => {
    const props = f.properties ?? {};
    let name = "";
    for (const key of NAME_KEYS) {
      const value = props[key];
      if (typeof value === "string" && value.trim()) {
        name = value.trim();
        break;
      }
    }
    return {
      type: "Feature" as const,
      geometry: f.geometry,
      properties: { name },
    };
  });
  return { type: "FeatureCollection", features };
}
