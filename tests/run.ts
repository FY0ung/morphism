// Zero-dependency test runner (node:assert based) — runs under Bun natively:
//
//   bun run test          # package script
//
// Each tests/*.test.ts exports `run(): void` that throws on failure. No test
// framework is installed on purpose (dependency policy); assertions come from
// node:assert/strict, which Bun implements.
import { run as normalize } from "./normalize.test";
import { run as floodDatasets } from "./flood-datasets.test";
import { run as hospitalFilter } from "./hospital-filter.test";
import { run as lru } from "./lru.test";
import { run as scenarioResolution } from "./scenario-resolution.test";

const suites: [string, () => void][] = [
  ["normalize", normalize],
  ["flood-datasets", floodDatasets],
  ["hospital-filter", hospitalFilter],
  ["lru", lru],
  ["scenario-resolution", scenarioResolution],
];

let failed = 0;
for (const [name, fn] of suites) {
  try {
    fn();
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
