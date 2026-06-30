"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ChatMessage, Scenario, ToolStep } from "@/types";

const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

let seq = 0;
const uid = (p: string) => `${p}-${Date.now()}-${seq++}`;

interface UseAiAssistantArgs {
  /** Interpret a query into a deterministic scenario (provided by the feature). */
  resolve: (text: string) => Scenario;
  /** Called once the steps finish, so the view can apply layers/camera/time. */
  onScenario: (scenario: Scenario) => void;
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

      // Build the steps list up to index `upto`, marking earlier ones done.
      const stepsUpTo = (upto: number): ToolStep[] =>
        scenario.steps.slice(0, upto + 1).map((s, i) => ({
          id: stepId(i),
          label: s.label,
          status: i < upto ? "done" : "running",
          ms: i < upto ? scenario.steps[i].wait : undefined,
        }));

      // user message + assistant placeholder (interim text + first step running)
      setMessages((prev) => [
        ...prev,
        { id: uid("u"), role: "user", text },
        {
          id: aiId,
          role: "ai",
          text: scenario.interim,
          pending: true,
          steps: stepsUpTo(0),
        },
      ]);

      const run = (fn: () => void, at: number) => {
        timers.current.push(setTimeout(fn, REDUCED ? 0 : at));
      };

      // Reveal/advance each step at its cumulative offset.
      let elapsed = 0;
      scenario.steps.forEach((step, k) => {
        const at = elapsed;
        if (k > 0) run(() => patch(aiId, { steps: stepsUpTo(k) }), at);
        elapsed += step.wait;
      });

      // Finish: all steps done, swap interim → result, attach chart.
      run(() => {
        patch(aiId, {
          pending: false,
          text: scenario.result,
          chart: scenario.chart,
          steps: scenario.steps.map((s, i) => ({
            id: stepId(i),
            label: s.label,
            status: "done" as const,
            ms: s.wait,
          })),
        });
        onScenario(scenario);
        setPending(false);
      }, elapsed);
    },
    [pending, resolve, onScenario, patch],
  );

  return { messages, ask, pending };
}
