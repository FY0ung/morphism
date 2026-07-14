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
export type ToolStepStatus = "running" | "done" | "error";

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
  /** คลาส token สำหรับสีเฉพาะแถว (เช่น "fill-background-info-default") — ถ้าไม่ระบุใช้สีเริ่มต้น */
  swatch?: string;
}

export interface ChartData {
  kind: "bar" | "donut";
  title: string;
  rows: ChartRow[];
  /** คำอธิบายกลางโดนัท (เช่น "ไร่ (รวม)") */
  centerLabel?: string;
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
  charts?: ChartData[];
  /** ข้อความสรุปผล (เช่น "พบ 128 แห่ง") */
  result?: string;
  /**
   * Raw user query that produced THIS assistant message. Kept so the transcript
   * can be re-resolved (text/step labels/charts) when the UI language changes,
   * so old replies follow the active EN/TH setting instead of freezing.
   */
  query?: string;
  /**
   * The swipe-compare selection this message applied (compare results only).
   * Lets the result card re-open the comparison after the user closed it.
   */
  swipe?: SwipeCompare;
}

/** ทิศการจัดวางหน้าจอ */
export type LayoutDirection = "ltr" | "rtl";

/**
 * A left–right flood swipe-compare. Each side is a resolved observation DATE
 * (YYYY-MM-DD) plus a display label — a year query resolves to that year's
 * representative snapshot, a date query to the exact date, so both share one
 * shape.
 */
export interface SwipeCompare {
  /** Left-side observation date (YYYY-MM-DD). */
  dateA: string;
  /** Right-side observation date (YYYY-MM-DD). */
  dateB: string;
  /** Left-side display label (e.g. "Year 2025" or "13 October 2025"). */
  labelA: string;
  /** Right-side display label. */
  labelB: string;
  /**
   * Optional PMTiles dataset keys. A year query carries its annual-cumulative
   * key (`year-2025`); a date query its date. The geojson fallback ignores
   * these and uses `dateA`/`dateB` (a year then means its snapshot date).
   */
  keyA?: string;
  keyB?: string;
}

/** Precomputed dataset stats (flood/<key>/stats.json.gz) — bbox, flooded area
 *  and totals ready-made so the browser never processes the full GeoJSON. */
export interface FloodStats {
  version: 1;
  key: string;
  kind: "date" | "year";
  dates: string[];
  bbox: [number, number, number, number];
  featureCount: number;
  areaKm2: number;
  areaRai: number;
  tileMinZoom: number;
  tileMaxZoom: number;
  generatedAt: string;
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

/** โหมดการแสดงผลของ scenario ("unknown" = ไม่แตะแผนที่) */
export type ScenarioMode = "points" | "aggregate" | "analysis" | "unknown";

/** วิธี resolve วันที่ของ scenario น้ำท่วม (ตรงวัน / ทั้งเดือน / ทั้งปี) */
export type FloodMatchMode = "exact-date" | "month" | "year";

/**
 * Metadata for the deterministic date-based flood scenario. All fields are
 * STABLE PRIMITIVES so the view can key its fetch effect on
 * `[scenarioId, date]` without an object/FeatureCollection dependency (the
 * previous infinite-request bug came from unstable deps).
 */
export interface FloodScenarioMeta {
  /** e.g. "flood-2025-10-13" (or "flood-empty-2025-09" when no data exists). */
  scenarioId: string;
  /** Observation date to fetch + display (YYYY-MM-DD). */
  date: string;
  /** How the query was interpreted. */
  matchMode: FloodMatchMode;
  /** Queried month (YYYY-MM) — set for month-mode messaging. */
  queriedMonth?: string;
  /** Thai legend label, e.g. "13 ตุลาคม 2568". */
  dateLabel: string;
  /** False when the query resolved to a date/month with no dataset. */
  hasData: boolean;
}

/** หนึ่งขั้นตอนเครื่องมือ: ป้าย + เวลาที่ใช้ (ms) ก่อนไปขั้นถัดไป */
export interface ScenarioStep {
  label: string;
  wait: number;
}

/**
 * Reports REAL tool-step progress from the scenario handler back to the chat, so
 * each step's displayed duration reflects actual elapsed time (not a hardcoded
 * value) and a step stays "running" until its real operation finishes.
 */
export interface ScenarioStepReporter {
  /** Mark step `index` done with its measured duration (ms); reveal the next. */
  done: (index: number, ms: number) => void;
  /** Mark step `index` FAILED/empty — the map did not get usable data, so the
   *  chat must not report success. Stops revealing further steps. */
  fail: (index: number, ms?: number) => void;
}

/**
 * Outcome a scenario handler reports back so the chat's final state matches the
 * MAP's actual state (single source of truth). `ok: false` → the chat shows the
 * empty/error message + a failed step instead of the baked success result.
 */
export interface ScenarioOutcome {
  ok: boolean;
  /** Result text to REPLACE the baked scenario result (empty/error, or a
   *  success message computed from live data such as the flood-compare areas). */
  message?: string;
  /** Charts computed from live data (e.g. real flood-compare areas), replacing
   *  the scenario's baked charts when present. */
  charts?: ChartData[];
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
  /**
   * ขอบเขตชุดข้อมูลโรงพยาบาลของ scenario (โหมด points) — กรองก่อนแสดง/รวมกลุ่ม
   * เช่น กรุงเทพ + 24 ชม. เพื่อไม่ให้ใช้ทั้งประเทศ. ถ้าไม่ระบุ = ใช้ชุดเต็ม.
   */
  hospitalScope?: { province?: string; h24?: boolean };
  /**
   * โหมดเปรียบเทียบรายภาค: วาดขอบเขตรายภาค (สีประจำภาค) + ตัวเลขหนึ่งป้ายต่อภาค
   * ซ่อนหมุด รพ. และไม่ลงลึก ADM2/ADM3. คู่กับ aggregate ที่เป็น "หนึ่งภาคต่อรายการ".
   */
  regionCompare?: boolean;
  /** เปิดตัวกรองเวลาหรือไม่ */
  timeActive?: boolean;
  /** ป้ายช่วงเวลาที่แสดงในชิปบนแผนที่ */
  timeLabel?: string;
  /** การ์ดกราฟ (มีได้หลายใบ เช่น donut + bar ในโหมดเทียบน้ำท่วม) */
  charts?: ChartData[];
  /** เปิดโหมดเทียบน้ำท่วมซ้าย–ขวา (ถ้ามี) */
  swipe?: SwipeCompare;
  /** โหมดน้ำท่วมตามวันที่ (deterministic date scenario) — ถ้ามี */
  flood?: FloodScenarioMeta;
  /** ข้อความระหว่างประมวลผล (โชว์ก่อน steps เสร็จ) */
  interim: string;
  /** ลำดับขั้นตอนเครื่องมือ (ป้าย + เวลา) */
  steps: ScenarioStep[];
  /** ข้อความผลลัพธ์สุดท้าย */
  result: string;
}
