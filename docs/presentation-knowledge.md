# FOSS4G 2026 — Presentation Knowledge (slide-sourced)

> **Source of truth: the FINAL FOSS4G slide deck** (`slide/Morphism.pdf`, 35 pages,
> re-exported 29 Aug 2026 — image-only export, read visually page by page).
>
> The public QR experience is for people who have **just watched the talk**, so every
> public answer must match the story that was actually presented.
>
> **Source priority**
> 1. Final slide deck ← wins every conflict
> 2. Speaker script / notes, when consistent with the slides
> 3. Supporting research documents
> 4. Knowledge primer
> 5. Runtime code — only for implementation details the slides do not discuss
>
> **Two separate concepts**
> - *Presentation knowledge* (this file → `morphism.knowledge.*`) answers "what was
>   presented at FOSS4G". It follows the deck.
> - *Runtime product behaviour* (scenario engine) keeps following the current code.
>   Nothing in this file changes scenario execution.
>
> Public answers must never be "corrected" using the runtime implementation. Where the
> two genuinely differ, the difference is recorded in **§ Runtime implementation notes**
> at the end — internal only, never surfaced to public users.
>
> **Slide numbering:** references are PDF page order (p.1–p.35). The deck's own printed
> footer numbers are inconsistent in this export (several duplicates), so page order is
> the reliable anchor.

---

## Deck map (as presented)

| Section | Pages |
|---|---|
| Title / presenter / contents | p.1–3 |
| 01 The Problem | p.4–7 |
| 02 Current Approaches and Their Limitations | p.8–10 |
| 03 The Approach | p.11–15 |
| Morphism reveal | p.16–17 |
| 04 App Demo | p.18–24 |
| 05 Evaluation and Reflections | p.25–30 |
| 06 Takeaways | p.31–35 |

---

## About Morphism

**Source:** p.16–17 (Morphism reveal), p.1 (title), p.15 (App Demo divider)

**Public answer:**
Morphism turns your questions into answers you can see and understand on the map.
It is presented as "New Experiences by Moldable Studio", inside the talk *Designing
Web Map Experiences — Beyond Too Much Data and Too Little Time with Intelligent AI
Processing*. The App Demo section frames it as "Morphism in practice — making the
design principles tangible, testable, and demonstrable."

**Supporting notes:** the title slide's own tags are *User Experiences · MapLibre GL JS ·
LLM + Function Calling*.

---

## The problem / why it was built

**Source:** p.4 (01 The Problem), p.5 ("9+ Clicks to Answer 1 Question")

**Public answer:**
"Maps are powerful tools, but access to their knowledge remains unequal, as the path
from question to answer still demands skills that many users do not possess." The talk
opens on a traditional flood portal where answering **one** question takes **9+ clicks**.

---

## Four sources of friction

**Source:** p.6–7 ("4 Sources of Friction and Their Cognitive Costs")

**Public answer:** the deck names four, in order:
1. **Layer Complexity** 2. **Temporal Filtering** 3. **Tool Activation** 4. **Spatial Analysis**

---

## Why not just ask an AI (motivation)

**Source:** p.8 (02 divider), p.9 ("AI Still Faces Challenges in Geospatial Reasoning
(2024–2026)"), p.10 ("The Opportunity — A Different Starting Point")

**Public answer:**
"Although the problem is evident, both traditional GIS workflows and direct AI-based
answering still carry important limitations." The deck's chart shows geospatial-reasoning
accuracy: **2024 Claude 3.5 S · MapEval 66%**, **2025 o4-mini · GeoBenchX 60%**,
**2026 GPT-5-mini · GPSBench 74%**, against a **human baseline ≈ 87% (MapEval)**.

So the talk proposes a different starting point — **Trust-Calibrated Design**:

| | Current AI-Assisted Systems | Trust-Calibrated Design |
|---|---|---|
| Assumption | Assumes a trustworthy backend model | Begins from the premise that models may not always be trustworthy |
| Objective | Focuses on maximizing automation | Focuses on fostering appropriate reliance on AI |
| Measure | Emphasizes task success as the primary outcome | Examines trust calibration as a key outcome |

---

## The approach

**Source:** p.11 (03 divider)

**Public answer:** "Rather than making the model smarter, we constrain its role and
design interactions that help users rely on it appropriately."

---

## Design Principles

**Source:** p.12 ("Four Principles, Each Grounded in Theory") — exact final wording

**Public answer:**
1. **Goal-Centric Input** — Users state their goals; the system plans the necessary steps. *(Narrowing the Gulf of Execution)*
2. **Constrained AI** — The model may plan and invoke tools, but it does not generate answers independently. *(Deterministic Trust Boundary)*
3. **Legible Reasoning** — Expose the steps, evidence, and sources behind each answer. *(Supporting Trust Calibration)*
4. **Reversible Control** — Users can undo, revise, or return to manual control at any time. *(Direct Manipulation · User Agency)*

Names must never be renamed or paraphrased.

---

## AI role — "The Gate"

**Source:** p.13 ("AI Reasoning Process — Planning Is Allowed, Answering Is Not")

**Public answer:**
The **LLM** may *interpret intent · plan actions*. At **The Gate**:
- **Blocked** — *Answer the Question Directly*: "May result in fabricated coordinates, facts, or unsupported claims."
- **Allowed** — *Invoke Deterministic Tools* → **Turf.js · PostGIS → Verifiable Results**.

So: the AI does not calculate the spatial answer itself.

---

## Architecture

**Source:** p.14 ("From Clicking Tools to Stating Goals"), p.15 ("System Workflow —
Three Layers, One Shared Tool Registry")

**Public answer:**
Flow presented: **Natural Language → LLM Interprets → Function Calling → Map-Based Answers**,
grouped as *User · State the goal* → *The System · Handles the steps* → *The Answer*.
- Natural Language — "Express what you need in familiar terms without having to learn the tools."
- LLM Interprets — "Transforms the user's intent into an executable sequence of actions."
- Function Calling — "Invokes deterministic tools to carry out the analysis."
- Map-Based Answers — "Presents results directly on the map in a form that supports decision-making."

Three layers, one shared tool registry:
- **Browser Layer** — Conversation · MapLibre canvas · Streamed execution steps · Undo support
- **Agent Layer (LLM)** — Interpret intent → Plan actions → Invoke deterministic tools
- **Deterministic Tools & Open Data** — Turf.js · PostGIS · PMTiles · GeoJSON · STAC

---

## The interface

**Source:** p.19 ("App Screens — The interface, annotated")

**Public answer:** five annotated parts —
**01 Chat Panel** (type a question or choose a suggested prompt) ·
**02 AI Context** (shows the data and context the AI is currently using) ·
**03 Process Steps** (follow what the system is doing and why at each step) ·
**04 Time Filter** (shows the time range of the data currently in use) ·
**05 Layer Panel** (view and manage the map layers at any time).

---

## The three demos

**Source:** p.20–22 ("Use Cases — Three Questions, Three Demos"), each shown as
Traditional vs Morphism side by side

**Public answer:**
1. **"Where were the flooded areas on 13 October 2025?"** — *find data → add layer → choose date*
2. **"When did the flooding happen?"** — *understand time range → find dates → show time filter*
3. **"How has flooding changed over time?"** — *compare dates → split view → measure change*

---

## Comparison demo

**Source:** p.22 (demo 03)

**Public answer:** Demo 3 compares two periods: compare dates → split view → measure
change, so you can see how flooding changed over time.

---

## User journey

**Source:** p.23 ("User Journey — One goal, two journeys")

**Public answer:**
- **Traditional:** Open the web → Find → Toggle → Date → Buffer → Query → Read —
  "7+ interactions · effort distributed across the entire process"
- **Morphism:** State the goal → Verify & proceed —
  "One expression of intent + a quick verification · effort shifts from operating the tool to evaluating the result"
- Closing line: "The journey does not simply become shorter — it reallocates user effort
  from operating the tool to evaluating the outcome."

---

## Five distinctive features

**Source:** p.24 ("What makes it distinctive — Five features that define the design")

**Public answer:**
- **Answers on the map** — "Results live in the spatial medium; the map itself is the answer." *(Display, not describe)*
- **Reasoning you can watch** *(Transparency)*
- **AI clearly labelled** *(Provenance)*
- **Everything reversible** *(Direct manipulation)*
- **Manual controls kept** *(Agency)*

---

## Evaluation — who we tested with

**Source:** p.25 (05 divider), p.26 ("Study Results — Who we tested with")

**Public answer:**
**25 people · 6 map tasks · 19 min** (median session from start to finish).
"Most were not map people. 16 of 25 never or rarely use a web map, 9 had no GIS
experience at all, and 9 had never used an AI assistant — this was a test with ordinary
users, not GIS professionals."
The section is framed as: "This is a formative prototype. Here we outline how it could be
evaluated, what we have observed so far, and what questions remain open."

---

## Evaluation — results

**Source:** p.27–28 ("Study Results — Three questions, three answers")

**Public answer:**
- **01 Usability — 62% time on task**
- **02 Cognitive Load — 4/4 workload measures lower**
- **03 User Experience — 83% preferred Morphism overall**

---

## Expected effort shift

**Source:** p.29 ("Early Observations — How We Expect User Effort to Shift")

**Public answer (with the deck's own disclaimer):**

| | Operating tools (clicks, toggles) | Interpreting overlapping layers | Waiting | The actual spatial question |
|---|---|---|---|---|
| Traditional | 40% | 20% | 10% | 30% |
| Morphism | 5% | 10% | 10% | 75% |

Slide footnote, quoted whenever this is discussed: *"Projected distribution informed by
Land Intelligence and Geospatial Ecosystem — not empirical results from Morphism users."*

---

## Limitations

**Source:** p.30 ("Limitations — What We Still Need to Validate")

**Public answer:** three, each with how the talk says they will be addressed —
1. **Model is scripted in the demo** — interaction shown; model behaviour not evaluated → *Wire the live LLM via the same tool registry*
2. **Expressivity ceiling** — NL can't specify many expert, long-tail operations → *Add hybrid NL + direct manipulation*
3. **Generalization unproven** — demonstrated for maps only → *Test other untrusted-AI + trusted-tool domains*

---

## Takeaways / closing

**Source:** p.31 (06 divider), p.33 (Takeaways), p.34 (closing quote)

**Public answer:**
"This work wasn't about making AI smarter. It was about designing interactions that help
people use imperfect AI with confidence."
1. AI removes complexity, not expertise
2. Let AI plan, let tools act
3. UX is the hardest part — and the heart

Closing quote: **"It's not about whether you use AI — it's about how well you design the UX."**
with "Thank you — the code is on GitHub. Please build on it."

---

## Open source

**Source:** p.32 ("Open Source — Open & Yours to build on")

**Public answer:** Yes — the code is open at **github.com/FY0ung/morphism**.
QR on that slide decodes to `https://github.com/FY0ung/morphism` (verified 4 resolutions).

---

## FOSS4G talk identity

**Source:** p.1 (title), p.2 (presenter)

**Public answer:**
- Talk: **Designing Web Map Experiences — Beyond Too Much Data and Too Little Time with Intelligent AI Processing**
- Event: **Foss4G 2026 · HIROSHIMA**
- Presenter: **Mayurachat Saechan** — UX Engineer, Moldable Studio
- Deck sections: 01 The Problem · 02 Current Approaches and Their Limitations ·
  03 Proposed Approach · 04 App Demo · 05 Evaluation and Reflections · 06 Key Takeaways

The in-app special prompt `01 September 2026` (FOSS4G Hiroshima invitation) is unchanged
by this knowledge work.

---

# Runtime implementation notes

Where the presented story and the current demo build differ. This section is
documentation for maintainers — the assistant never quotes it: public answers follow the
presentation framing above.

Publishing it is deliberate. The talk's own limitations slide (p.30) already states
"Model is scripted in the demo — interaction shown; model behaviour not evaluated", so
recording the rest of the gaps in the open is consistent with the project's argument
about legible reasoning and honest disclosure.

| Topic | Presentation framing (deck) | Runtime demo implementation (current `main`) |
|---|---|---|
| AI layer | Agent Layer (LLM) interprets intent and plans actions | Deterministic keyword/scenario resolver; no live LLM call. **The deck itself discloses this on p.30: "Model is scripted in the demo."** |
| Deterministic tools | Turf.js · PostGIS | Dependency-free geodesic/haversine math server-side; no Turf, no PostGIS package |
| Open data row | PMTiles · GeoJSON · STAC | PMTiles + GeoJSON in use; STAC not wired |
| Flood comparison chart | p.22 screenshot shows a donut ("Flooded area by year") | Live app renders a horizontal bar chart — two periods are independent magnitudes, not parts of one whole. Region-hospital comparison still uses a donut |
| Demo 3 pairing | "compare dates → split view → measure change" | Same interaction; snapshots resolved from the registry |
| Study figures | 25 people · 6 map tasks · 19 min · 62% · 4/4 · 83% (p.26–28) | Study results doc analysed 24 complete sessions of 25 starters and records 8 (not 9) with no GIS experience. **Deck values are the public values** — do not substitute |
| Effort split | Traditional 40/20/10/30 · Morphism 5/10/10/75, explicitly "projected … not empirical" (p.29) | Study doc §10.1 proposes an evidence-based alternative. Not used publicly; the deck's projection with its footnote is what was presented |
| "24-hour hospitals" | Not a deck demo | App chip exists; dataset has no 24-hour attribute (documented no-op) |
| 5 km analysis | Not one of the three deck demos ("Buffer" appears only as a step in the Traditional journey, p.23) | App feature exists; internals documented in `docs/hospitals-within-flood-buffer-analysis.md` |
