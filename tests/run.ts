// Zero-dependency test runner (node:assert based) — runs under Bun natively:
//
//   bun run test          # package script
//
// Each tests/*.test.ts exports `run(): void` that throws on failure. No test
// framework is installed on purpose (dependency policy); assertions come from
// node:assert/strict, which Bun implements.
import { run as normalize } from "./normalize.test";
import { run as floodDatasets } from "./flood-datasets.test";
import { run as floodProximity } from "./flood-proximity.test";
import { run as floodRadiusAnalysis } from "./flood-radius-analysis.test";
import { run as hospitalFilter } from "./hospital-filter.test";
import { run as lru } from "./lru.test";
import { run as settings } from "./settings.test";
import { run as dataPalette } from "./data-palette.test";
import { run as regionPalette } from "./region-palette.test";
import { run as initialFloodContext } from "./initial-flood-context.test";
import { run as scenarioResolution } from "./scenario-resolution.test";
import { run as floodPeriod } from "./flood-period.test";
import { run as floodCompareChart } from "./flood-compare-chart.test";
import { run as mobileSheet } from "./mobile-sheet.test";
import { run as japaneseIntent } from "./japanese-intent.test";
import { run as foss4gPrompt } from "./foss4g-prompt.test";
import { run as presentationKnowledge } from "./presentation-knowledge.test";
import { run as chipPrompts } from "./chip-prompts.test";
import { run as i18n } from "./i18n.test";

// Suites may be sync or async (flood-proximity awaits dataset resolution).
const suites: [string, () => void | Promise<void>][] = [
  ["normalize", normalize],
  ["flood-datasets", floodDatasets],
  ["flood-proximity", floodProximity],
  ["flood-radius-analysis", floodRadiusAnalysis],
  ["hospital-filter", hospitalFilter],
  ["lru", lru],
  ["settings", settings],
  ["data-palette", dataPalette],
  ["region-palette", regionPalette],
  ["initial-flood-context", initialFloodContext],
  ["scenario-resolution", scenarioResolution],
  ["flood-period", floodPeriod],
  ["flood-compare-chart", floodCompareChart],
  ["mobile-sheet", mobileSheet],
  ["japanese-intent", japaneseIntent],
  ["foss4g-prompt", foss4gPrompt],
  ["presentation-knowledge", presentationKnowledge],
  ["chip-prompts", chipPrompts],
  ["i18n", i18n],
];

async function main(): Promise<void> {
  let failed = 0;
  for (const [name, fn] of suites) {
    try {
      await fn();
      console.log(`✅ ${name}`);
    } catch (err) {
      failed++;
      console.error(`❌ ${name}`);
      console.error(err);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed}/${suites.length} suite(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${suites.length} suites passed`);
}

void main();
