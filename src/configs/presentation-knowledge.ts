/**
 * FOSS4G 2026 presentation knowledge — deterministic answers about the TALK.
 *
 * SOURCE OF TRUTH: the FINAL FOSS4G slide deck (slide/Morphism.pdf, 35 pages).
 * Every topic below carries the deck page(s) it was extracted from; the full
 * extraction lives in docs/presentation-knowledge.md.
 *
 * Rules (release brief):
 * - The slides win every conflict. Public answers follow the presented story and
 *   are never "corrected" using the runtime implementation.
 * - Presentation knowledge and runtime scenario execution stay separate: a
 *   knowledge answer performs NO map operation (mode "unknown", no layers, no
 *   camera, no steps, no time-pill change).
 * - Matchers are strict full phrases so real GIS queries and the suggestion
 *   chips can never be stolen by the knowledge base.
 *
 * Answer copy: src/languages/project/{en,th,ja}.json under morphism.knowledge.*
 * All three locales state the SAME facts (parity is enforced by tests).
 */

import type { TranslationKey } from "@/languages/types";

/** Figures quoted from the final deck. Locked by tests/presentation-knowledge
 *  so a later edit cannot silently change what the talk reported. */
export const SLIDE_FACTS = {
  /** p.5 — "9+ Clicks to Answer 1 Question" */
  clicksToAnswer: "9+",
  /** p.9 — geospatial-reasoning accuracy chart */
  benchmark: { y2024: 66, y2025: 60, y2026: 74, human: 87 },
  /** p.23 — Traditional journey */
  traditionalInteractions: "7+",
  /** p.26 — "Who we tested with" */
  study: { people: 25, tasks: 6, medianMinutes: 19 },
  /** p.26 — participant background */
  background: { rarelyUseWebMap: 16, noGisExperience: 9, neverUsedAi: 9 },
  /** p.27 — "Three questions, three answers" */
  results: { timeOnTask: "62%", workload: "4/4", preferred: "83%" },
  /** p.29 — projected effort split (NOT empirical; deck footnote) */
  effort: {
    traditional: { operating: 40, interpreting: 20, waiting: 10, question: 30 },
    morphism: { operating: 5, interpreting: 10, waiting: 10, question: 75 },
  },
  /** p.32 — open-source destination (QR verified) */
  repoUrl: "github.com/FY0ung/morphism",
} as const;

export interface KnowledgeTopic {
  /** Stable id — scenario id becomes `knowledge-<id>`. */
  id: string;
  /** Deck page(s) this answer is extracted from (PDF page order). */
  slides: string;
  /** i18n key under morphism.knowledge.* holding the answer text. */
  msgKey: TranslationKey;
  /** Regexes tested against the normalised (folded + lowercased) query. */
  patterns: RegExp[];
}

/** Order matters: the first match wins, so put the more specific principle and
 *  result topics before the broader "principles"/"results" catch-alls. */
export const KNOWLEDGE_TOPICS: KnowledgeTopic[] = [
  // ── About / problem / motivation ──────────────────────────────────────────
  {
    id: "about",
    slides: "p.16–17, p.1",
    msgKey: "morphism.knowledge.about",
    patterns: [
      /what( i|')s morphism/, /what is morphism/, /tell me about morphism/,
      /morphism ?คืออะไร/, /morphism (คือ|เป็น)อะไร/, /รู้จัก ?morphism/,
      /morphismとは/, /morphismって(何|なに)/, /morphismについて/,
    ],
  },
  {
    id: "problem",
    slides: "p.4–5",
    msgKey: "morphism.knowledge.problem",
    patterns: [
      /what problem/, /which problem/, /problem (are|is) (you|this|it|morphism)/,
      /why (did you|was it|did they) (build|create|make)/,
      /why (build|create|make) morphism/, /what motivated/,
      /ทำไม(ถึง)?(สร้าง|ทำ|พัฒนา)/, /แก้ปัญหาอะไร/, /ปัญหาคืออะไร/,
      /なぜ(作|つく)/, /どんな(課題|問題)/, /解決したい(課題|問題)/,
    ],
  },
  {
    id: "friction",
    slides: "p.6–7",
    msgKey: "morphism.knowledge.friction",
    patterns: [
      /sources? of friction/, /what friction/, /why are (traditional )?web maps (hard|difficult)/,
      /too much data and too little time/,
      /friction ?(คือ|มีอะไร)/, /อุปสรรค(คือ|มีอะไร)/, /ทำไมเว็บแผนที่(ยาก|ใช้ยาก)/,
      /(摩擦|ボトルネック)(は|とは)/, /なぜ(ウェブ)?地図は難しい/,
    ],
  },
  {
    id: "why-not-ai",
    slides: "p.9–10",
    msgKey: "morphism.knowledge.whyNotAi",
    patterns: [
      /why not just ask (an )?ai/, /can'?t (the )?ai (just )?answer/,
      /how (good|accurate) is ai at (maps|geospatial)/, /geospatial reasoning/,
      /trust[- ]calibrated design/, /benchmark/,
      /ทำไมไม่(ให้|ใช้) ?ai ?ตอบ/, /ai (แม่น|เก่ง)แค่ไหน/,
      /なぜaiに(直接)?聞かない/, /aiの(精度|正確)/,
    ],
  },

  // ── Design principles (specific first) ────────────────────────────────────
  {
    id: "goal-centric",
    slides: "p.12",
    msgKey: "morphism.knowledge.goalCentric",
    patterns: [/goal[- ]cent(ric|ered) input/, /goal[- ]cent(ric|ered)/, /goal ?centric/],
  },
  {
    id: "constrained-ai",
    slides: "p.12–13",
    msgKey: "morphism.knowledge.constrainedAi",
    patterns: [
      /constrained ai/, /constrain(ing|s)? the (model|ai)/,
      /constrained ai ?คืออะไร/, /制約された ?ai/, /ai(を|の)制約/,
    ],
  },
  {
    id: "legible-reasoning",
    slides: "p.12",
    msgKey: "morphism.knowledge.legibleReasoning",
    patterns: [
      /legible reasoning/, /reasoning you can watch/,
      /legible reasoning ?คืออะไร/, /読み取れる推論/, /推論の可視化/,
    ],
  },
  {
    id: "reversible-control",
    slides: "p.12",
    msgKey: "morphism.knowledge.reversibleControl",
    patterns: [
      /reversible control/, /why is user control important/, /user agency/,
      /reversible control ?คืออะไร/, /ทำไม(การ)?ควบคุม.*สำคัญ/,
      /可逆(的)?(な)?(制御|コントロール)/, /なぜ(ユーザー)?の制御が(重要|大事)/,
    ],
  },
  {
    id: "principles",
    slides: "p.12",
    msgKey: "morphism.knowledge.principles",
    patterns: [
      /design principles?/, /four principles/, /what principles/,
      /หลักการออกแบบ/, /หลักการ ?4 ?ข้อ/, /設計原則/, /デザイン原則/,
    ],
  },

  // ── AI role & architecture ────────────────────────────────────────────────
  {
    id: "ai-role",
    slides: "p.13",
    msgKey: "morphism.knowledge.aiRole",
    patterns: [
      /how does morphism use ai/, /how does the ai work/, /what does the ai do/,
      /does (the )?ai (calculate|compute|generate|create|answer)/,
      /the gate/, /planning is allowed/,
      /ai ?(ทำงาน|มีบทบาท|ทำหน้าที่)(อย่างไร|ยังไง|อะไร)/, /ai ?(คำนวณ|สร้าง)(คำตอบ)?(เอง)?(ไหม|หรือ)/,
      /ai(は|が)(何|なに)を(して|し)/, /aiが(答え|計算)を/, /aiはどう(動作|機能)/,
    ],
  },
  {
    id: "architecture",
    slides: "p.14–15",
    msgKey: "morphism.knowledge.architecture",
    patterns: [
      /architecture/, /how does (it|this|morphism) work/, /system workflow/,
      /what happens when i type/, /tool registry/, /three layers/,
      /function calling/, /technolog(y|ies)/, /tech stack/, /built with/,
      /สถาปัตยกรรม/, /ทำงาน(อย่างไร|ยังไง)(เบื้องหลัง)?/, /พิมพ์(คำถาม)?แล้วเกิดอะไร/,
      /ใช้เทคโนโลยีอะไร/, /アーキテクチャ/, /どういう仕組み/, /技術スタック/, /(どんな|どの)技術/,
    ],
  },
  {
    id: "interface",
    slides: "p.19",
    msgKey: "morphism.knowledge.interface",
    patterns: [
      /what (is|are) (on|in) the (screen|interface)/, /interface annotated/,
      /(what|explain) (is )?(the )?(ai context|process steps|chat panel|layer panel|time filter)/,
      /หน้าจอ(มีอะไร|ประกอบด้วย)/, /ส่วนประกอบ(ของ)?(หน้าจอ|อินเทอร์เฟซ)/,
      /(画面|インターフェース)(には|の構成)/,
    ],
  },
  {
    id: "features",
    slides: "p.24",
    msgKey: "morphism.knowledge.features",
    patterns: [
      /five features/, /what makes it distinctive/, /distinctive features/,
      /5 ?ฟีเจอร์/, /จุดเด่น(คือ|มีอะไร)/, /5つの(特徴|機能)/, /特徴は/,
    ],
  },

  // ── Demos ─────────────────────────────────────────────────────────────────
  {
    id: "demos",
    slides: "p.20–22",
    msgKey: "morphism.knowledge.demos",
    patterns: [
      /what (were|are) the (three|3) demos/, /three demos/, /three questions, three demos/,
      /which demos/, /demos? (did you|were) (show|shown|present)/,
      /(สาม|3) ?เดโม/, /เดโม(มี|คือ)อะไร/, /3つの(デモ|事例)/, /デモは(何|なに)/,
    ],
  },
  {
    id: "comparison",
    slides: "p.22",
    msgKey: "morphism.knowledge.comparison",
    patterns: [
      /how does (the )?(flood )?comparison work/, /how do you compare (the )?flood/,
      /donut chart/, /why (did you|is the comparison|isn'?t the comparison)/,
      /split view/, /การเปรียบเทียบทำงาน(อย่างไร|ยังไง)/, /โดนัท/,
      /比較は?どのように/, /ドーナツ/,
    ],
  },
  {
    id: "journey",
    slides: "p.23",
    msgKey: "morphism.knowledge.journey",
    patterns: [
      /user journey/, /one goal, two journeys/, /how many (interactions|steps|clicks)/,
      /effort (shift|reallocat)/, /เส้นทางผู้ใช้/, /กี่(ขั้นตอน|คลิก)/,
      /ユーザージャーニー/, /何(ステップ|回|クリック)/,
    ],
  },

  // ── Evaluation ────────────────────────────────────────────────────────────
  {
    id: "study",
    slides: "p.25–26",
    msgKey: "morphism.knowledge.study",
    patterns: [
      /how many (people|users|participants)/, /who did you test (with|on)/,
      /who was tested/, /study (setup|design)/, /user study/, /how was it tested/,
      /(ทดสอบ|ผู้เข้าร่วม|เข้าร่วม).{0,8}กี่คน/, /กี่คน(ที่)?(ทดสอบ|เข้าร่วม)/, /ทดสอบ(กับ)?ใคร/,
      /何人(が|で|に)?(テスト|参加)/, /(誰|どんな人)(と|に)テスト/,
    ],
  },
  {
    id: "results",
    slides: "p.27",
    msgKey: "morphism.knowledge.results",
    patterns: [
      /what (were|are) the (study )?results?/, /study results?/, /what did you find/,
      /was morphism faster/, /time on task/, /how much faster/,
      /ผล(การ)?(ทดสอบ|ศึกษา|วิจัย)/, /เร็วขึ้น(เท่าไร|แค่ไหน)?/,
      /(テスト|調査|評価|それ)?(の)?結果は?ど[うの]/, /(テスト|調査|評価)(の)?結果/, /速く?なりました/,
    ],
  },
  {
    id: "cognitive-load",
    slides: "p.27",
    msgKey: "morphism.knowledge.cognitiveLoad",
    patterns: [
      /cognitive[- ]load/, /workload (result|measure)/, /mental (load|effort) result/,
      /ภาระทางความคิด/, /認知(的)?負荷/, /ワークロード/,
    ],
  },
  {
    id: "preference",
    slides: "p.27",
    msgKey: "morphism.knowledge.preference",
    patterns: [
      /did (users|people|participants) prefer/, /which (one )?did (they|users) prefer/,
      /preference result/, /preferred morphism/,
      /(ผู้ใช้|คน)ชอบ.*(มากกว่า|ไหน)/, /ความชอบ/,
      /(どちら|どっち)が?(好ま|人気)/, /ユーザーは?どちらを/,
    ],
  },
  {
    id: "effort",
    slides: "p.29",
    msgKey: "morphism.knowledge.effort",
    patterns: [
      /effort (to )?shift/, /how (we|you) expect user effort/, /effort distribution/,
      /การกระจายความพยายาม/, /ความพยายามของผู้ใช้/, /(労力|作業量)の(配分|シフト)/,
    ],
  },
  {
    id: "limitations",
    slides: "p.30",
    msgKey: "morphism.knowledge.limitations",
    patterns: [
      /limitations?/, /what (can'?t|cannot) (it|you|morphism) do/,
      /what (do you|still) need to validate/, /is the model scripted/,
      /ข้อจำกัด/, /ทำอะไรไม่ได้/, /(制限|制約)(は|事項)/, /できないこと/,
    ],
  },

  // ── Closing / identity ────────────────────────────────────────────────────
  {
    id: "takeaway",
    slides: "p.31, p.33–34",
    msgKey: "morphism.knowledge.takeaway",
    patterns: [
      /(main |key )?takeaways?/, /what('| i)s the (main|key) (message|point|lesson)/,
      /conclusion/, /สิ่งที่อยากให้จำ/, /ข้อสรุป/, /บทสรุป/,
      /(まとめ|結論)/, /一番(伝えたい|重要)/,
    ],
  },
  {
    id: "open-source",
    slides: "p.32",
    msgKey: "morphism.knowledge.openSource",
    patterns: [
      /is (it|morphism) open[- ]source/, /open[- ]source/, /where is the code/,
      /github/, /can i (use|fork|clone) (it|the code)/,
      /โอเพนซอร์ส/, /โค้ดอยู่ที่ไหน/, /オープンソース/, /コードは?どこ/,
    ],
  },
  {
    id: "foss4g",
    slides: "p.1–2",
    msgKey: "morphism.knowledge.foss4g",
    patterns: [
      /where (was|is) [^?]{0,30}present/, /foss4g/,
      /what is the talk (about|title)/, /who (is the presenter|presented|gave the talk)/,
      /นำเสนอที่(ไหน|งานอะไร)/, /ใครเป็นผู้(นำเสนอ|พูด)/, /ชื่อ(หัวข้อ|งาน)/,
      /どこで(発表|講演)/, /発表者は/, /トークの(タイトル|内容)/,
    ],
  },
];

/** First topic whose pattern matches the normalised query, else null.
 *  `nq` must already be folded + lowercased (see normalizeQuery). */
export function matchKnowledgeTopic(nq: string): KnowledgeTopic | null {
  for (const topic of KNOWLEDGE_TOPICS) {
    for (const re of topic.patterns) if (re.test(nq)) return topic;
  }
  return null;
}
