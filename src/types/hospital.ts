import type { FeatureCollection } from "./geo";

// DTO ของชั้น "โรงพยาบาล" — จุดบนแผนที่ + เปิด 24 ชม. หรือไม่
export interface HospitalProps {
  name: string;
  /** เปิดบริการฉุกเฉิน 24 ชั่วโมง */
  h24: boolean;
  /** ดัชนีจังหวัด (อ้างอิงตารางจังหวัด) — optional */
  province?: string;
}

export type HospitalFC = FeatureCollection<HospitalProps>;

export interface HospitalQuery {
  /** กรองเฉพาะที่เปิด 24 ชม. */
  h24?: boolean;
  /** west,south,east,north */
  bbox?: [number, number, number, number];
}
