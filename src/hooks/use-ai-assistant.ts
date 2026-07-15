"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ChatMessage,
  Scenario,
  ScenarioOutcome,
  ScenarioStepReporter,
  ToolStep,
} from "@/types";

import { isReducedMotion } from "@/lib/reduced-motion";

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

interface UseAiAssistantArgs {
  /** Interpret a query into a deterministic scenario (provided by the feature). */
  resolve: (text: string) => Scenario;
  /**
   * Called once the steps finish, so the view can apply layers/camera/time.
   * May return a Promise (e.g. the flood scenario) that resolves only after the
   * map has committed the data AND finished moving — the chat is marked complete
   * only after it resolves, so the sidebar never reports done before the map.
   */
  onScenario: (
    scenario: Scenario,
    report?: ScenarioStepReporter,
  ) => void | Promise<void | ScenarioOutcome>;
}

/**
 * Owns the chat transcript + the animated "tool step" lifecycle of the mock
 * assistant. Step labels / interim / result text all come from the resolved
 * scenario (ported from the HTML reference). Map side-effects are delegated
 * via `onScenario`.
 */
export function useAiAssistant({ resolve, onScenario }: UseAiAssistantArgs) {
  const { t } = useTranslation();
  // Seed the greeting in the initializer — i18n is initialised at module load
  // with a stable default language, so SSR and first client render agree (no
  // hydration mismatch) and we avoid setState-in-effect.
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: "greeting", role: "ai", text: t("morphism.greeting") },
  ]);
  const [pending, setPending] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );


  const patch = useCallback((id: string, update: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...update } : m)),
    );
  }, []);

  const ask = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || pending) return;
      setPending(true);

      const scenario = resolve(text);
      const aiId = uid("ai");
      const stepId = (i: number) => `${aiId}-s${i}`;

      // Render steps with `doneCount` completed (each showing its measured ms,
      // falling back to the scenario's nominal wait if not measured) and the next
      // one "running". Reveals incrementally like the reference timeline.
      const renderSteps = (doneCount: number, doneMs: number[]): ToolStep[] =>
        scenario.steps
          .slice(0, Math.min(doneCount + 1, scenario.steps.length))
          .map((s, i) => ({
            id: stepId(i),
            label: s.label,
            status: i < doneCount ? "done" : "running",
            ms: i < doneCount ? doneMs[i] ?? s.wait : undefined,
          }));

      // Final patch: result text + all steps done with their measured durations.
      const finalize = (doneMs: number[]) => {
        patch(aiId, {
          pending: false,
          text: scenario.result,
          charts: scenario.charts,
          steps: scenario.steps.map((s, i) => ({
            id: stepId(i),
            label: s.label,
            status: "done" as const,
            ms: doneMs[i] ?? s.wait,
          })),
        });
        setPending(false);
      };

      // user message + assistant placeholder (interim text + first step running)
      setMessages((prev) => [
        ...prev,
        { id: uid("u"), role: "user", text },
        {
          id: aiId,
          role: "ai",
          text: scenario.interim,
          pending: true,
          steps: renderSteps(0, []),
          query: text,
          // Compare queries carry their selection so the result card can
          // re-open the comparison after the user closes it.
          swipe: scenario.swipe,
        },
      ]);

      // ── Flood: REAL-driven steps. The handler measures each stage and reports
      // its true duration; steps stay "running" until their operation finishes
      // (load = fetch/paginate/dedupe, fit_bounds = until moveend). No fake
      // timers, so the displayed durations are the measured ones. ──────────────
      if (scenario.flood || scenario.swipe) {
        const doneMs: number[] = [];
        let doneCount = 0;
        let failedAt: number | null = null;
        // Steps reflect the MAP's real state: a step is "done" only after its
        // work succeeded; "error" when the map got no usable data; steps after a
        // failure are never revealed as green.
        const buildFloodSteps = (): ToolStep[] => {
          const revealTo =
            failedAt != null
              ? failedAt + 1
              : Math.min(doneCount + 1, scenario.steps.length);
          return scenario.steps.slice(0, revealTo).map((s, i) => ({
            id: stepId(i),
            label: s.label,
            status: failedAt === i ? "error" : i < doneCount ? "done" : "running",
            ms:
              failedAt === i || i < doneCount ? doneMs[i] ?? s.wait : undefined,
          }));
        };
        const report: ScenarioStepReporter = {
          done: (index, ms) => {
            doneMs[index] = ms;
            doneCount = index + 1;
            patch(aiId, { steps: buildFloodSteps() });
          },
          fail: (index, ms) => {
            if (ms != null) doneMs[index] = ms;
            failedAt = index;
            patch(aiId, { steps: buildFloodSteps() });
          },
        };
        const finishFlood = (outcome: void | ScenarioOutcome) => {
          const ok = !(outcome && outcome.ok === false);
          patch(aiId, {
            pending: false,
            // A successful outcome may carry a live-computed message/charts
            // (e.g. the flood-compare areas); fall back to the baked scenario.
            text: ok
              ? outcome?.message ?? scenario.result
              : outcome?.message ?? scenario.result,
            charts: ok ? outcome?.charts ?? scenario.charts : undefined,
            steps: buildFloodSteps(),
          });
          setPending(false);
        };
        void Promise.resolve(onScenario(scenario, report))
          .then(finishFlood)
          .catch(() => {
            if (failedAt == null)
              failedAt = Math.min(1, scenario.steps.length - 1);
            finishFlood({ ok: false });
          });
        return;
      }

      // ── Non-flood: legacy timed animation (nominal waits). ──────────────────
      const run = (fn: () => void, at: number) => {
        timers.current.push(setTimeout(fn, isReducedMotion() ? 0 : at));
      };
      const nominal = scenario.steps.map((s) => s.wait);
      let elapsed = 0;
      scenario.steps.forEach((step, k) => {
        const at = elapsed;
        if (k > 0) run(() => patch(aiId, { steps: renderSteps(k, nominal) }), at);
        elapsed += step.wait;
      });
      run(() => {
        void Promise.resolve(onScenario(scenario)).finally(() =>
          finalize(nominal),
        );
      }, elapsed);
    },
    [pending, resolve, onScenario, patch],
  );

  // Present the transcript in the ACTIVE language: settled AI messages are
  // re-resolved from their stored query so past replies follow the EN/TH
  // setting instead of freezing in the language they were generated in.
  // `resolve` is pure and closes over the current language, so this is derived
  // (no setState-in-effect). Measured step durations + statuses are preserved —
  // only the human-readable labels/text/charts are swapped.
  const displayMessages = useMemo<ChatMessage[]>(
    () =>
      messages.map((m) => {
        if (m.id === "greeting") return { ...m, text: t("morphism.greeting") };
        if (m.role !== "ai" || m.pending || !m.query) return m;
        const s = resolve(m.query);
        return {
          ...m,
          text: s.result,
          charts: s.charts ?? m.charts,
          // Re-resolved swipe carries language-correct labels for the card.
          swipe: s.swipe ?? m.swipe,
          steps: m.steps?.map((st, i) => ({
            ...st,
            label: s.steps[i]?.label ?? st.label,
          })),
        };
      }),
    [messages, resolve, t],
  );

  return { messages: displayMessages, ask, pending };
}
