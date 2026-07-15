// Flood dataset registry — derived month/year aliases + availability, and the
// BE/CE date resolution used by the chat (lib/flood-date).
import assert from "node:assert/strict";
import {
  FLOOD_DATASET_BY_MONTH,
  FLOOD_DATASET_BY_YEAR,
  FLOOD_DATASET_DATES,
  FLOOD_LATEST_DATASET_YEAR,
  floodDatasetAvailable,
} from "@/configs/flood-datasets";
import { resolveFloodDate } from "@/lib/flood-date";

export function run(): void {
  // ── registry shape ───────────────────────────────────────────────────────
  assert.ok(FLOOD_DATASET_DATES.length >= 21);
  for (const d of FLOOD_DATASET_DATES) assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
  // No duplicates.
  assert.equal(new Set(FLOOD_DATASET_DATES).size, FLOOD_DATASET_DATES.length);

  // ── derived aliases: latest snapshot per month / per year ────────────────
  assert.equal(FLOOD_DATASET_BY_MONTH["2025-10"], "2025-10-19");
  assert.equal(FLOOD_DATASET_BY_MONTH["2022-10"], "2022-10-20");
  assert.equal(FLOOD_DATASET_BY_YEAR["2024"], "2024-10-12");
  assert.equal(FLOOD_DATASET_BY_YEAR["2023"], "2023-10-20");
  assert.equal(FLOOD_LATEST_DATASET_YEAR, 2025);

  // ── availability: exact date only, NO silent substitution ───────────────
  assert.equal(floodDatasetAvailable("2025-10-13"), true);
  assert.equal(floodDatasetAvailable("2022-10-14"), true);
  assert.equal(floodDatasetAvailable("2025-10-18"), false); // gap day
  assert.equal(floodDatasetAvailable("2021-10-13"), false); // year w/o data

  // ── Gregorian + Buddhist-Era prompt dates resolve to the same canonical ──
  const en = resolveFloodDate("flood 13 October 2025");
  assert.equal(en.matchMode, "exact-date");
  assert.equal(en.resolvedDate, "2025-10-13");

  const th = resolveFloodDate("น้ำท่วม 13 ตุลาคม 2568"); // BE 2568 = CE 2025
  assert.equal(th.matchMode, "exact-date");
  assert.equal(th.resolvedDate, "2025-10-13");

  const en22 = resolveFloodDate("14 October 2022");
  assert.equal(en22.resolvedDate, "2022-10-14");
  const th22 = resolveFloodDate("14 ตุลาคม 2565");
  assert.equal(th22.resolvedDate, "2022-10-14");

  // Month prompt (TH, BE year) → month key; registry then maps to the latest
  // snapshot in that month (labelled as such — not passed off as another day).
  const m = resolveFloodDate("น้ำท่วมเดือนตุลาคม 2568");
  assert.equal(m.matchMode, "month");
  assert.equal(m.resolvedMonth, "2025-10");
  assert.equal(FLOOD_DATASET_BY_MONTH[m.resolvedMonth!], "2025-10-19");
}
