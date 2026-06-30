import type { FeatureCollection } from "./geo";

// DTO ของชั้น "พื้นที่น้ำท่วม" — โพลิกอนพร้อมระดับความรุนแรง
export interface FloodProps {
  /** พ.ศ. ของเหตุการณ์ เช่น 2569 */
  year: number;
  /** ระดับความรุนแรง 1–3 */
  severity: 1 | 2 | 3;
  areaKm2?: number;
}

export type FloodFC = FeatureCollection<FloodProps>;
