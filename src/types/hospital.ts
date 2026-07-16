import type { FeatureCollection } from "./geo";

// DTO ของชั้น "โรงพยาบาล" — จุดบนแผนที่ + เปิด 24 ชม. หรือไม่
export interface HospitalProps {
  name: string;
  /** เปิดบริการฉุกเฉิน 24 ชั่วโมง — `undefined` เมื่อชุดข้อมูลไม่มีธงนี้
   *  (ผู้ใช้ธง h24 ต้องข้าม filter สำหรับชุดข้อมูลที่ไม่มีข้อมูล ไม่ใช่ถือว่า false) */
  h24?: boolean;
  /** ดัชนีจังหวัด (อ้างอิงตารางจังหวัด) — optional */
  province?: string;
  /** อยู่ในรัศมีวิเคราะห์ (buffer) → ลงสีแดง */
  risk?: boolean;
  /** ระยะทางจริงถึงขอบพื้นที่น้ำท่วมที่ใกล้สุด (กม.; 0 = อยู่ในโพลิกอน) —
   *  ใส่โดย /api/flood-buffer เท่านั้น */
  distanceKm?: number;
}

export type HospitalFC = FeatureCollection<HospitalProps>;

export interface HospitalQuery {
  /** กรองเฉพาะที่เปิด 24 ชม. */
  h24?: boolean;
  /** west,south,east,north */
  bbox?: [number, number, number, number];
}
