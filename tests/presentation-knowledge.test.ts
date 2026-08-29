// FOSS4G presentation knowledge — the FINAL SLIDE DECK is the source of truth.
//
// This suite guards four things:
//   1. The figures quoted from the deck cannot drift (SLIDE_FACTS is locked).
//   2. Every locale states the SAME facts (parity by topic id + numbers in text,
//      never by comparing translated prose).
//   3. A knowledge question answers WITHOUT touching the map (no layers, no
//      camera, no steps, no time filter) — even while a scenario is active.
//   4. Real GIS queries, the suggestion chips and the FOSS4G prompt are never
//      stolen by the knowledge matcher.
import assert from "node:assert/strict";
import { resolveScenario } from "@/sections/morphism/const";
import {
  KNOWLEDGE_TOPICS,
  SLIDE_FACTS,
  matchKnowledgeTopic,
} from "@/configs/presentation-knowledge";
import { normalizeQuery } from "@/configs/intent-keywords";
import type { TFunction } from "@/languages/types";
import en from "@/languages/project/en.json";
import th from "@/languages/project/th.json";
import ja from "@/languages/project/ja.json";

const key = ((k: string) => k) as unknown as TFunction;
const LOCALES = [
  ["en", en],
  ["th", th],
  ["ja", ja],
] as const;

const dig = (res: typeof en, k: string) =>
  k.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], res);

export function run(): void {
  // ── 1. Deck figures are locked (final slide deck, PDF page order) ────────
  assert.equal(SLIDE_FACTS.clicksToAnswer, "9+", "p.5 — 9+ clicks");
  assert.deepEqual(
    SLIDE_FACTS.benchmark,
    { y2024: 66, y2025: 60, y2026: 74, human: 87 },
    "p.9 — geospatial reasoning chart",
  );
  assert.equal(SLIDE_FACTS.traditionalInteractions, "7+", "p.23 — 7+ interactions");
  assert.deepEqual(
    SLIDE_FACTS.study,
    { people: 25, tasks: 6, medianMinutes: 19 },
    "p.26 — 25 people · 6 map tasks · 19 min",
  );
  assert.deepEqual(
    SLIDE_FACTS.background,
    { rarelyUseWebMap: 16, noGisExperience: 9, neverUsedAi: 9 },
    "p.26 — participant background",
  );
  assert.deepEqual(
    SLIDE_FACTS.results,
    { timeOnTask: "62%", workload: "4/4", preferred: "83%" },
    "p.27 — three questions, three answers",
  );
  assert.deepEqual(
    SLIDE_FACTS.effort.traditional,
    { operating: 40, interpreting: 20, waiting: 10, question: 30 },
    "p.29 — traditional effort split",
  );
  assert.deepEqual(
    SLIDE_FACTS.effort.morphism,
    { operating: 5, interpreting: 10, waiting: 10, question: 75 },
    "p.29 — Morphism effort split (projected, not empirical)",
  );
  assert.equal(SLIDE_FACTS.repoUrl, "github.com/FY0ung/morphism", "p.32 — repo");

  // ── 2. Every topic has copy in all three locales, and each is slide-sourced
  for (const topic of KNOWLEDGE_TOPICS) {
    assert.ok(/^p\.\d/.test(topic.slides), `${topic.id} must cite deck pages`);
    for (const [name, res] of LOCALES) {
      const v = dig(res, topic.msgKey);
      assert.equal(typeof v, "string", `${topic.msgKey} missing in ${name}`);
      assert.ok((v as string).length > 30, `${topic.msgKey} too short in ${name}`);
    }
  }

  // ── 3. Cross-language FACT parity ───────────────────────────────────────
  // Facts, not prose: every locale must quote the SAME deck figures. Locales
  // legitimately differ in how they render counts ("three layers" vs 「3層」),
  // so we assert the required figures are present rather than demanding an
  // identical numeral set.
  const F = SLIDE_FACTS;
  const REQUIRED_FIGURES: Record<string, string[]> = {
    problem: [F.clicksToAnswer.replace("+", "")],
    "why-not-ai": [
      String(F.benchmark.y2024),
      String(F.benchmark.y2025),
      String(F.benchmark.y2026),
      String(F.benchmark.human),
    ],
    journey: [F.traditionalInteractions.replace("+", "")],
    study: [
      String(F.study.people),
      String(F.study.tasks),
      String(F.study.medianMinutes),
      String(F.background.rarelyUseWebMap),
      String(F.background.noGisExperience),
    ],
    results: [
      F.results.timeOnTask.replace("%", ""),
      F.results.preferred.replace("%", ""),
      "4",
    ],
    "cognitive-load": ["4"],
    preference: [F.results.preferred.replace("%", "")],
    effort: [
      String(F.effort.traditional.operating),
      String(F.effort.traditional.interpreting),
      String(F.effort.traditional.question),
      String(F.effort.morphism.operating),
      String(F.effort.morphism.question),
    ],
    "open-source": [F.repoUrl],
    foss4g: ["2026"],
  };
  for (const [id, figures] of Object.entries(REQUIRED_FIGURES)) {
    const topic = KNOWLEDGE_TOPICS.find((t) => t.id === id);
    assert.ok(topic, `unknown topic in parity table: ${id}`);
    for (const [name, res] of LOCALES) {
      const text = dig(res, topic.msgKey) as string;
      for (const fig of figures) {
        assert.ok(
          text.includes(fig),
          `${id} (${name}) must quote the deck figure "${fig}"`,
        );
      }
    }
  }

  // The repo URL is a proper noun: identical in all locales.
  for (const [name, res] of LOCALES) {
    assert.ok(
      (dig(res, "morphism.knowledge.openSource") as string).includes(SLIDE_FACTS.repoUrl),
      `openSource (${name}) must cite ${SLIDE_FACTS.repoUrl}`,
    );
  }

  // Principle names are the deck's exact terminology — never renamed/translated.
  const PRINCIPLES = [
    ["morphism.knowledge.goalCentric", "Goal-Centric Input"],
    ["morphism.knowledge.constrainedAi", "Constrained AI"],
    ["morphism.knowledge.legibleReasoning", "Legible Reasoning"],
    ["morphism.knowledge.reversibleControl", "Reversible Control"],
  ] as const;
  for (const [k, name] of PRINCIPLES) {
    for (const [loc, res] of LOCALES) {
      assert.ok(
        (dig(res, k) as string).includes(name),
        `${k} (${loc}) must keep the exact principle name "${name}"`,
      );
    }
  }
  for (const [loc, res] of LOCALES) {
    const all = dig(res, "morphism.knowledge.principles") as string;
    for (const [, name] of PRINCIPLES) {
      assert.ok(all.includes(name), `principles (${loc}) must list "${name}"`);
    }
  }

  // ── 4. Knowledge questions answer WITHOUT any map operation ──────────────
  const asked: [string, string][] = [
    ["What is Morphism?", "about"],
    ["Tell me about Morphism", "about"],
    ["Why did you build Morphism?", "problem"],
    ["What problem are you trying to solve?", "problem"],
    ["What friction was identified?", "friction"],
    ["Why not just ask an AI?", "why-not-ai"],
    ["How does Morphism use AI?", "ai-role"],
    ["Does AI calculate the answer itself?", "ai-role"],
    ["What is Goal-Centric Input?", "goal-centric"],
    ["What is Constrained AI?", "constrained-ai"],
    ["What is Legible Reasoning?", "legible-reasoning"],
    ["What is Reversible Control?", "reversible-control"],
    ["Why is user control important?", "reversible-control"],
    ["What are the design principles?", "principles"],
    ["What is the architecture?", "architecture"],
    ["What happens when I type a question?", "architecture"],
    ["What technologies does Morphism use?", "architecture"],
    ["What are the five features?", "features"],
    ["What were the three demos?", "demos"],
    ["How does the flood comparison work?", "comparison"],
    ["Why did you replace the donut chart?", "comparison"],
    ["What is the user journey?", "journey"],
    ["How many users tested Morphism?", "study"],
    ["Who did you test with?", "study"],
    ["What were the results?", "results"],
    ["Was Morphism faster?", "results"],
    ["What happened to cognitive load?", "cognitive-load"],
    ["Did users prefer Morphism?", "preference"],
    ["How do you expect user effort to shift?", "effort"],
    ["What are the limitations?", "limitations"],
    ["What is the main takeaway from the presentation?", "takeaway"],
    ["Is Morphism open source?", "open-source"],
    ["Where was Morphism presented?", "foss4g"],
    ["What is the FOSS4G talk about?", "foss4g"],
    // Thai
    ["Morphism คืออะไร", "about"],
    ["ทำไมถึงสร้าง Morphism", "problem"],
    ["หลักการออกแบบมีอะไรบ้าง", "principles"],
    ["AI ทำงานอย่างไร", "ai-role"],
    ["ทดสอบกับกี่คน", "study"],
    ["ผลการทดสอบเป็นอย่างไร", "results"],
    ["ข้อจำกัดคืออะไร", "limitations"],
    ["โค้ดอยู่ที่ไหน", "open-source"],
    ["นำเสนอที่งานอะไร", "foss4g"],
    // Japanese
    ["Morphismとは何ですか", "about"],
    ["なぜ作ったのですか", "problem"],
    ["設計原則は何ですか", "principles"],
    ["何人がテストしましたか", "study"],
    ["結果はどうでしたか", "results"],
    ["制限はありますか", "limitations"],
    ["オープンソースですか", "open-source"],
  ];
  for (const [q, id] of asked) {
    const topic = matchKnowledgeTopic(normalizeQuery(q));
    assert.ok(topic, `no knowledge match: ${q}`);
    assert.equal(topic.id, id, `${q} → ${topic.id}, expected ${id}`);

    const s = resolveScenario(q, key, "en");
    assert.equal(s.id, `knowledge-${id}`, q);
    assert.equal(s.mode, "unknown", `${q} must not run map analysis`);
    assert.equal(s.layers.length, 0, `${q} must not load layers`);
    assert.equal(s.steps.length, 0, `${q} must not run tool steps`);
    assert.equal(s.camera, undefined, `${q} must not move the camera`);
    assert.equal(s.timeActive, undefined, `${q} must not change the time filter`);
    assert.equal(s.timeLabel, undefined, `${q} must not label the time pill`);
    assert.equal(s.swipe, undefined, `${q} must not start a comparison`);
    assert.equal(s.charts, undefined, `${q} must not draw a chart`);
    assert.equal(s.flood, undefined, `${q} must not resolve flood data`);
    assert.equal(s.analysis, undefined, `${q} must not run analysis`);
    assert.equal(s.presentation, undefined, `${q} is not a presentation scene`);
  }

  // Same guarantee in TH and JA resolution paths.
  for (const lang of ["th", "ja"] as const) {
    const s = resolveScenario("What is Morphism?", key, lang);
    assert.equal(s.id, "knowledge-about");
    assert.equal(s.layers.length, 0);
    assert.equal(s.camera, undefined);
  }

  // ── 5. Real GIS queries must still resolve to their scenarios ────────────
  const gis = [
    "Show 24-hour hospitals in Bangkok",
    "How many hospitals are in Chiang Mai?",
    "How many hospitals are in the North?",
    "Compare hospitals: North vs Northeast",
    "Recent Songkran flooding events",
    "Hospitals within 5 km of flood areas",
    "Where were the flooded areas on 13 October 2025?",
    "When did the flooding happen in mid October 2025?",
    "Compare flooding October 2025 vs October 2022",
    "flood 13 oct 2025",
    "latest flood",
    "01 September 2026",
    "น้ำท่วมล่าสุด",
    "โรงพยาบาลในเชียงใหม่",
    "โรงพยาบาลภายใน 5 กม. จากพื้นที่น้ำท่วม",
    "洪水 2025年10月13日",
    "5km以内の病院",
  ];
  for (const q of gis) {
    assert.equal(
      matchKnowledgeTopic(normalizeQuery(q)),
      null,
      `knowledge false positive: ${q}`,
    );
    const s = resolveScenario(q, key, "en");
    assert.ok(!s.id.startsWith("knowledge-"), `${q} resolved to ${s.id}`);
  }
  // The FOSS4G easter egg keeps priority over everything.
  assert.equal(resolveScenario("01 September 2026", key, "en").id, "foss4g");
}
