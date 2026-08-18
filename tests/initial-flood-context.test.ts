// Initial DEFAULT map context: the newest usable registered flood DATE
// snapshot shown automatically on open. Pure resolver units + the view/legend
// source contracts (this runner is DOM-free by design): it is map CONTEXT,
// never an AI scenario — no chat message, no history entry, no camera move,
// no raw-GeoJSON download, graceful empty-state fallback.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveInitialFloodContext } from "@/lib/initial-flood-context";
import { FLOOD_DATASET_DATES } from "@/configs/flood-datasets";
import en from "@/languages/project/en.json";
import th from "@/languages/project/th.json";
import ja from "@/languages/project/ja.json";

const read = (...p: string[]) =>
  readFileSync(path.join(process.cwd(), ...p), "utf8");
const viewSrc = read("src", "sections", "morphism", "view", "morphism-view.tsx");
const legendSrc = read("src", "sections", "morphism", "layout", "workspace", "legend.tsx");
const libSrc = read("src", "lib", "initial-flood-context.ts");

/** The marked initial-context effect block in the view. */
const effectBlock = viewSrc.slice(
  viewSrc.indexOf("INITIAL-CONTEXT-EFFECT-START"),
  viewSrc.indexOf("INITIAL-CONTEXT-EFFECT-END"),
);

export function run(): Promise<void> {
  return (async () => {
    // ── 1. Newest registered usable snapshot wins ────────────────────────────
    const picked = await resolveInitialFloodContext(
      FLOOD_DATASET_DATES,
      async () => true,
    );
    assert.equal(picked, FLOOD_DATASET_DATES[0], "newest registry entry");

    // ── 2. Not hard-coded: a different registry yields ITS newest entry, and
    //      no source file bakes a date literal into the selection ────────────
    const other = await resolveInitialFloodContext(
      ["2030-01-05", "2029-12-31"],
      async () => true,
    );
    assert.equal(other, "2030-01-05");
    assert.ok(
      !/\d{4}-\d{2}-\d{2}/.test(libSrc),
      "resolver has no hard-coded date",
    );
    assert.ok(
      !/["']\d{4}-\d{2}-\d{2}["']/.test(effectBlock),
      "view effect has no hard-coded date",
    );

    // ── 3. Year-aggregate keys are never the initial snapshot ────────────────
    const withYearKey = await resolveInitialFloodContext(
      ["year-2025", "2025-10-19"],
      async () => true,
    );
    assert.equal(withYearKey, "2025-10-19", "year-* keys skipped by shape");

    // Unusable/rejecting newest → next usable; none usable → null (fallback
    // to the empty initial state — startup must not break). (14)
    const skipsUnusable = await resolveInitialFloodContext(
      ["2025-12-18", "2025-10-19"],
      async (d) => d !== "2025-12-18",
    );
    assert.equal(skipsUnusable, "2025-10-19");
    const throwing = await resolveInitialFloodContext(
      ["2025-12-18", "2025-10-19"],
      async (d) => {
        if (d === "2025-12-18") throw new Error("asset missing");
        return true;
      },
    );
    assert.equal(throwing, "2025-10-19", "rejecting probe skips one date only");
    assert.equal(
      await resolveInitialFloodContext(FLOOD_DATASET_DATES, async () => false),
      null,
      "no usable snapshot → null (empty state kept)",
    );

    // ── 4/5. Context ≠ AI scenario: no chat message, no history entry, no
    //         camera move, inside the marked effect ──────────────────────────
    assert.ok(effectBlock.length > 100, "marked effect block exists");
    for (const forbidden of ["ask(", "recordScene(", "fitBounds", "flyTo(", "showToast("]) {
      assert.ok(
        !effectBlock.includes(forbidden),
        `initial-context effect never calls ${forbidden}`,
      );
    }
    // Scenario supersedes the context; reset re-arms it. (11 / restore)
    assert.ok(
      viewSrc.includes("pristineRef.current = false;\n      setInitialContext(null);"),
      "onScenario clears the context and marks the app non-pristine",
    );
    assert.ok(
      viewSrc.includes("pristineRef.current = true;\n    setContextArm((c) => c + 1);"),
      "clearScene re-arms the context (cache-backed, no duplicate sources)",
    );

    // ── 6. Time pill: truthful localized snapshot label ──────────────────────
    for (const [name, res] of Object.entries({ en, th, ja })) {
      const label = (res as typeof en).morphism.timeSnapshot;
      assert.ok(
        typeof label === "string" && label.includes("{{date}}"),
        `${name}: timeSnapshot key with {{date}}`,
      );
      assert.ok(
        !/current|live|real[- ]?time/i.test(label),
        `${name}: label claims a snapshot, not live data`,
      );
    }
    assert.ok(
      viewSrc.includes('t("morphism.timeSnapshot"') &&
        viewSrc.includes("formatDate(initialContext.date, lang)"),
      "pill uses the resolved date via the existing locale formatter",
    );
    // Clearing the pill removes the layer + returns to All data. (9)
    assert.ok(
      viewSrc.includes("if (initialContext !== null) dismissInitialContext();"),
      "pill ✕ dismisses the context",
    );
    assert.ok(
      /dismissInitialContext[\s\S]{0,400}setFloodOverview\(null\)[\s\S]{0,200}commitFloodTiles\(null\)/.test(
        viewSrc,
      ),
      "dismissal releases overview + tiles (empty state restored)",
    );

    // ── 7. Legend: plain "Flood areas" row (the pill carries the date) via
    //      the palette-aware data role ────────────────────────────────────────
    const contextBranch = legendSrc.slice(
      legendSrc.indexOf(": floodContext ? ("),
      legendSrc.indexOf(": floodDateLabel ? ("),
    );
    assert.ok(contextBranch.length > 0, "legend has a context branch");
    assert.ok(
      contextBranch.includes('t("morphism.layer.flood")'),
      "legend context row is the plain localized Flood areas label",
    );
    assert.ok(
      !contextBranch.includes("floodDate"),
      "legend context row carries no date (that lives in the time pill)",
    );
    assert.ok(
      contextBranch.includes("bg-data-flood"),
      "legend swatch uses the active data palette (Default/Viridis/Gray)",
    );

    // ── 8. AI-sees uses the real layer count (context applies a REAL layer,
    //       flagged as NOT an AI action) ─────────────────────────────────────
    assert.ok(
      effectBlock.includes('applyExact(["flood"], false)'),
      "context turns the flood layer on via the normal layer state (byAI=false)",
    );
    assert.ok(
      viewSrc.includes("layers: String(visibleCount)"),
      "AI-sees badge keeps reading the live visible-layer count",
    );

    // ── 12/13. Palette/theme/lang switches never re-select the dataset ──────
    const depsMatch = effectBlock.match(/\}, \[([^\]]*)\]\);/);
    assert.ok(depsMatch, "effect dependency list found");
    for (const dep of ["lang", "colorVision", "resolvedTheme"]) {
      assert.ok(
        !depsMatch![1].includes(dep),
        `context effect never re-runs on ${dep} (no refetch on switch)`,
      );
    }

    // ── 15. Lightweight only: stats/overview/PMTiles — never raw GeoJSON ────
    assert.ok(
      !effectBlock.includes("getFloodAreas(") &&
        !effectBlock.includes("getFloodDetailInBBox("),
      "initial load never downloads the raw full GeoJSON",
    );
    assert.ok(
      effectBlock.includes("getFloodStats(") &&
        effectBlock.includes("getFloodOverviewByKey(") &&
        effectBlock.includes("getFloodOverviewAsset("),
      "initial load uses the lightweight stats/overview artifacts",
    );
    assert.ok(
      !effectBlock.includes("areaKm2("),
      "no area calculation during initial load",
    );
  })();
}
