// Shared UI types for the Morphism feature (chat + map workspace).

/** ชั้นข้อมูลที่สลับเปิด/ปิดได้บนแผนที่ */
export type LayerId = "hospitals" | "flood" | "buffer" | "boundaries";

/** สถานะการมองเห็น + ป้ายว่าชั้นนี้ถูกเปิดโดย AI */
export interface LayerState {
  visible: boolean;
  /** เปิดโดย AI (โชว์ป้าย "AI") */
  byAI: boolean;
}

export type LayersState = Record<LayerId, LayerState>;

/** หนึ่งขั้นตอนของ "เครื่องมือ" ที่ AI เรียกใช้ (โชว์ใน chat) */
export type ToolStepStatus = "running" | "done";

export interface ToolStep {
  id: string;
  label: string;
  status: ToolStepStatus;
  /** ระยะเวลาเป็น ms (โชว์ต่อท้ายเมื่อ done) */
  ms?: number;
}

/** หนึ่งแถวของกราฟแท่ง/โดนัท */
export interface ChartRow {
  label: string;
  value: number;
}

export interface ChartData {
  kind: "bar" | "donut";
  title: string;
  rows: ChartRow[];
  /** ใช้ตั้งชื่อไฟล์ตอน export */
  exportName: string;
}

export type ChatRole = "user" | "ai";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** ข้อความหลัก (ว่างได้ระหว่างกำลังคิด) */
  text: string;
  /** true ระหว่าง AI กำลังประมวลผล */
  pending?: boolean;
  steps?: ToolStep[];
  chart?: ChartData;
  /** ข้อความสรุปผล (เช่น "พบ 128 แห่ง") */
  result?: string;
}

/** ทิศการจัดวางหน้าจอ */
export type LayoutDirection = "ltr" | "rtl";

/** คู่ปีสำหรับโหมดเทียบน้ำท่วมซ้าย–ขวา (flood swipe) */
export interface SwipeCompare {
  /** ปี (พ.ศ.) ฝั่งซ้าย — โพลิกอนบนแผนที่ซ้อนที่ถูก clip */
  yearA: number;
  /** ปี (พ.ศ.) ฝั่งขวา — โพลิกอนบนแผนที่หลักด้านล่าง */
  yearB: number;
}

/** กล้องแผนที่สำหรับ flyTo (ค่าพอร์ตตรงจาก HTML reference) */
export interface MapCamera {
  center: [number, number];
  zoom: number;
  /** ระยะเวลา animation (ms) — 0 เมื่อ prefers-reduced-motion */
  duration: number;
}

/** ขอบเขตสำหรับ fitBounds (มุมล่างซ้าย/บนขวา เป็น [lng, lat]) */
export interface MapBounds {
  sw: [number, number];
  ne: [number, number];
  duration: number;
}

/** จำนวนโรงพยาบาลรวมต่อจังหวัด (สำหรับโหมด aggregation) */
export interface ProvinceCount {
  /** ชื่อจังหวัด (ไทย) */
  name: string;
  /** ศูนย์กลางจังหวัด [lng, lat] */
  center: [number, number];
  /** จำนวนโรงพยาบาลรวม */
  count: number;
}

/** โหมดการแสดงผลของ scenario */
export type ScenarioMode = "points" | "aggregate" | "analysis";

/** หนึ่งขั้นตอนเครื่องมือ: ป้าย + เวลาที่ใช้ (ms) ก่อนไปขั้นถัดไป */
export interface ScenarioStep {
  label: string;
  wait: number;
}

/** ผลการตีความคำถาม (deterministic scenario — ดู resolveScenario ใน const.tsx) */
export interface Scenario {
  /** รหัส scenario */
  id: string;
  /** โหมดการแสดงผล: จุด รพ. / สรุปรายจังหวัด / วิเคราะห์พื้นที่ */
  mode: ScenarioMode;
  /** ชั้นข้อมูลที่ AI เปิด */
  layers: LayerId[];
  /** กล้อง flyTo (ถ้ามี) */
  camera?: MapCamera;
  /** กล้อง fitBounds (โหมด aggregate ครอบทั้งภาค) */
  bounds?: MapBounds;
  /** ข้อมูลสรุปรายจังหวัด (โหมด aggregate) */
  aggregate?: ProvinceCount[];
  /** รายชื่อจังหวัดที่ต้องวาดโพลิกอนขอบเขต (โหมด aggregate) */
  provinceNames?: string[];
  /** เปิดตัวกรองเวลาหรือไม่ */
  timeActive?: boolean;
  /** ป้ายช่วงเวลาที่แสดงในชิปบนแผนที่ */
  timeLabel?: string;
  /** การ์ดกราฟ (ถ้ามี) */
  chart?: ChartData;
  /** เปิดโหมดเทียบน้ำท่วมซ้าย–ขวา (ถ้ามี) */
  swipe?: SwipeCompare;
  /** ข้อความระหว่างประมวลผล (โชว์ก่อน steps เสร็จ) */
  interim: string;
  /** ลำดับขั้นตอนเครื่องมือ (ป้าย + เวลา) */
  steps: ScenarioStep[];
  /** ข้อความผลลัพธ์สุดท้าย */
  result: string;
}
