// Mobile AI bottom sheet: snap geometry, the always-visible chat input, and
// the floating map chrome that rides above the sheet — all MOBILE ONLY.
// Desktop (≥ md) must keep the existing chat column, resizer, Try asking
// section and 56px input. The runner is DOM-free by design (no test framework
// dependency), so component contracts are asserted from their class strings.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MAP_CHROME_BOTTOM_CLASS,
  MAP_CHROME_TRANSITION_CLASS,
  SHEET_CHROME_GAP_PX,
  SHEET_DEFAULT_SNAP,
  SHEET_HEIGHT_VAR,
  SHEET_MOBILE_QUERY,
  SHEET_SNAP_ORDER,
  SHEET_SNAP_VH,
  nearestSnapByHeight,
  snapHeightPx,
  stepSnap,
} from "@/configs/mobile-sheet";

const read = (...p: string[]) =>
  readFileSync(path.join(process.cwd(), ...p), "utf8");

const sheetSrc = read("src", "sections", "morphism", "layout", "chat", "mobile-sheet.tsx");
const hookSrc = read("src", "hooks", "use-bottom-sheet.ts");
const panelSrc = read("src", "sections", "morphism", "layout", "chat", "chat-panel.tsx");
const listSrc = read("src", "sections", "morphism", "layout", "chat", "message-list.tsx");
const chipsSrc = read("src", "sections", "morphism", "layout", "chat", "suggestion-chips.tsx");
const inputSrc = read("src", "sections", "morphism", "layout", "chat", "chat-input.tsx");
const viewSrc = read("src", "sections", "morphism", "view", "morphism-view.tsx");
const legendSrc = read("src", "sections", "morphism", "layout", "workspace", "legend.tsx");
const resizerSrc = read("src", "sections", "morphism", "layout", "resizer.tsx");

export function run(): void {
  const VH = 800; // reference viewport height for the geometry assertions

  // ── 1. Mobile chat input is present (regression: it was off-screen) ──────
  // The sheet is SIZED from the shared height var (bottom edge = viewport
  // bottom), so the input below the scroll area is on-screen in every state.
  assert.ok(
    panelSrc.includes("<ChatInput"),
    "the sheet renders the SAME ChatInput (no mobile-only duplicate)",
  );
  assert.ok(
    sheetSrc.includes(`h-[var(${SHEET_HEIGHT_VAR},50dvh)]`),
    "sheet height comes from the shared variable (input stays in-viewport)",
  );
  assert.ok(
    !sheetSrc.includes("h-[88dvh]") && !hookSrc.includes("translate3d"),
    "sheet is no longer a translated 88dvh box (that hid the input)",
  );

  // ── 2. Mobile input resting height = 40px, desktop unchanged ────────────
  assert.ok(inputSrc.includes("h-10!"), "mobile control is 40px tall");
  assert.ok(inputSrc.includes("md:h-14!"), "desktop keeps the 56px pill");
  assert.ok(
    inputSrc.includes("items-center"),
    "placeholder, avatar and send icon stay vertically centred",
  );
  assert.ok(
    inputSrc.includes("env(safe-area-inset-bottom)"),
    "input clears the home indicator",
  );
  assert.ok(
    inputSrc.includes("focus-within:border-border-primary-default"),
    "focus ring preserved",
  );
  // Send button: 32px on mobile, unchanged 40px (the `medium` preset) at md+.
  // Goes through IconButton's responsive size hook — the preset ships its
  // width/height as `!important`, which a plain className could never override.
  assert.ok(
    inputSrc.includes('sizeClassName="size-8 md:size-10"'),
    "send button is 32px on mobile and 40px on desktop",
  );
  assert.ok(
    !inputSrc.includes("size-8!") && !inputSrc.includes("md:size-auto!"),
    "no !important tug-of-war left on the send button",
  );
  assert.ok(
    inputSrc.includes('aria-label={t("morphism.send")}') &&
      inputSrc.includes('<Icon name="Send01"'),
    "accessible label + existing send icon preserved",
  );
  assert.ok(
    inputSrc.includes('disabled={disabled || value.trim() === ""}'),
    "disabled/loading + submit behaviour preserved",
  );

  // ── 3. Input available in collapsed / default / expanded ────────────────
  // It is a flex sibling AFTER the scroll area, inside a sheet whose height is
  // always the visible height — so no snap can push it out of view.
  const inputIdx = panelSrc.indexOf("<ChatInput");
  const listIdx = panelSrc.indexOf("<MessageList");
  assert.ok(listIdx < inputIdx, "input sits AFTER the message list");
  assert.ok(
    !listSrc.includes("<ChatInput"),
    "input is NOT inside the scrolling message list",
  );
  for (const snap of SHEET_SNAP_ORDER) {
    assert.ok(snapHeightPx(snap, VH) > 0, `${snap} has a visible height`);
  }

  // ── 4. Try asking stays hidden on mobile, unchanged on desktop ──────────
  assert.ok(
    /className="hidden [^"]*md:flex/.test(chipsSrc),
    "suggestion chips are display:none on mobile, flex from md up",
  );

  // ── 5/6/7. Legend, Settings and AI-sees sit ABOVE the sheet ─────────────
  assert.ok(
    MAP_CHROME_BOTTOM_CLASS.includes(`var(${SHEET_HEIGHT_VAR}`) &&
      MAP_CHROME_BOTTOM_CLASS.includes(`+${SHEET_CHROME_GAP_PX}px`),
    "chrome offset = sheet height + the 8–12px clearance gap",
  );
  assert.ok(
    MAP_CHROME_BOTTOM_CLASS.includes("md:bottom-4"),
    "desktop keeps the original bottom-4 offset",
  );
  assert.ok(
    legendSrc.includes("MAP_CHROME_BOTTOM_CLASS"),
    "legend (bottom-left) uses the shared offset",
  );
  // The right-hand column holds Settings + the AI-sees badge.
  assert.ok(
    viewSrc.includes("MAP_CHROME_BOTTOM_CLASS"),
    "settings + AI-sees column uses the shared offset",
  );
  assert.ok(
    viewSrc.includes("<SettingsPopover") && viewSrc.includes("morphism.context"),
    "Settings and AI-sees remain map chrome (not chat content)",
  );
  assert.ok(
    !legendSrc.includes("absolute bottom-4 left-4"),
    "legend no longer hard-codes a bottom offset under the sheet",
  );

  // ── 8. All three respond to sheet position from ONE source of truth ─────
  assert.equal(SHEET_HEIGHT_VAR, "--mobile-sheet-h");
  assert.ok(
    hookSrc.includes("setProperty(SHEET_HEIGHT_VAR"),
    "the hook is the only writer of the shared height variable",
  );
  // No component recomputes snap points for itself.
  for (const [name, src] of [
    ["legend", legendSrc],
    ["view", viewSrc],
  ] as const) {
    assert.ok(
      !src.includes("SHEET_SNAP_VH") && !src.includes("snapHeightPx"),
      `${name} does not re-derive snap geometry`,
    );
  }
  assert.ok(
    MAP_CHROME_TRANSITION_CLASS.includes("transition-[bottom]") &&
      legendSrc.includes("!sheetDragging") &&
      viewSrc.includes("!sheet.dragging"),
    "chrome tracks the sheet live while dragging, eases on snap",
  );

  // ── 9/10. No map remount, no scenario reset when the sheet moves ────────
  assert.ok(
    !/\bmap\s*[.?]\s*resize\s*\(/.test(hookSrc) &&
      !/\bmapRef\b/.test(hookSrc) &&
      !/maplibre/i.test(hookSrc),
    "sheet never calls map.resize() or touches the MapLibre instance",
  );
  assert.ok(
    viewSrc.indexOf("</MobileSheet>") < viewSrc.indexOf("<MapCanvas"),
    "map is a sibling AFTER the sheet — never a child that could unmount",
  );
  assert.ok(
    !hookSrc.includes("resolveScenario") && !hookSrc.includes("onScenario"),
    "sheet state is independent of scenario execution",
  );
  // Drag writes the variable from refs inside rAF — no per-move React state.
  assert.ok(
    hookSrc.includes("requestAnimationFrame") && hookSrc.includes("heightRef"),
    "drag publishes height in rAF from refs, committing state only on release",
  );

  // ── 11. The message area is the only scrolling region ───────────────────
  assert.ok(
    /min-h-0 flex-1 flex-col gap-4 overflow-y-auto/.test(listSrc),
    "messages scroll independently (flex-1 + min-h-0 + overflow-y-auto)",
  );
  assert.ok(
    listSrc.includes("overscroll-contain"),
    "scroll chaining cannot move the page/sheet unexpectedly",
  );
  assert.ok(
    listSrc.includes("scrollTop") && listSrc.includes("onPullDown"),
    "pull-to-drag only hands off at scrollTop 0",
  );
  assert.ok(
    listSrc.includes("closest("),
    "interactive controls in the transcript never start a sheet drag",
  );
  assert.ok(
    !inputSrc.includes("onPointerDown"),
    "touching the input never starts a sheet drag",
  );

  // ── 12/13/14. Desktop regression lock ──────────────────────────────────
  assert.equal(SHEET_MOBILE_QUERY, "(max-width: 767.98px)"); // below Tailwind md
  assert.ok(sheetSrc.includes("md:contents"), "wrapper vanishes on desktop");
  assert.ok(sheetSrc.includes("md:hidden"), "drag handle is mobile-only");
  assert.ok(
    hookSrc.includes("removeProperty(SHEET_HEIGHT_VAR)"),
    "leaving mobile removes the variable (desktop reads nothing from it)",
  );
  assert.ok(
    viewSrc.includes("md:basis-(--chat-w,400px)") &&
      viewSrc.includes("md:shrink-0") &&
      viewSrc.includes("md:grow-0"),
    "desktop chat column keeps its exact computed box (resizer width)",
  );
  assert.ok(
    resizerSrc.includes("hidden") && resizerSrc.includes("md:block"),
    "desktop resizer unchanged",
  );
  assert.ok(
    !hookSrc.includes("--chat-w") && !hookSrc.includes("localStorage"),
    "sheet state never touches desktop chat width persistence",
  );

  // ── snap geometry (bands, ordering, resolution) ────────────────────────
  assert.equal(SHEET_DEFAULT_SNAP, "default");
  assert.deepEqual(SHEET_SNAP_ORDER, ["collapsed", "default", "expanded"]);
  assert.ok(SHEET_SNAP_VH.collapsed >= 0.18 && SHEET_SNAP_VH.collapsed <= 0.22);
  assert.ok(SHEET_SNAP_VH.default >= 0.45 && SHEET_SNAP_VH.default <= 0.55);
  assert.ok(SHEET_SNAP_VH.expanded >= 0.85 && SHEET_SNAP_VH.expanded <= 0.92);
  assert.ok(snapHeightPx("expanded", VH) > snapHeightPx("default", VH));
  assert.ok(snapHeightPx("default", VH) > snapHeightPx("collapsed", VH));
  assert.equal(nearestSnapByHeight(snapHeightPx("default", VH) + 4, VH), "default");
  assert.equal(nearestSnapByHeight(VH, VH), "expanded");
  assert.equal(nearestSnapByHeight(0, VH), "collapsed");
  assert.equal(stepSnap("collapsed", -1), "collapsed");
  assert.equal(stepSnap("collapsed", 1), "default");
  assert.equal(stepSnap("expanded", 1), "expanded");

  // ── reduced motion + safe area + keyboard ──────────────────────────────
  assert.ok(
    sheetSrc.includes("useReducedMotionPref") &&
      sheetSrc.includes("motion-reduce:transition-none"),
    "snap animation respects prefers-reduced-motion",
  );
  assert.ok(
    sheetSrc.includes("!dragging &&"),
    "no transition while dragging (height follows the pointer 1:1)",
  );
  assert.ok(
    hookSrc.includes("visualViewport"),
    "software keyboard tracked so the input stays visible",
  );
  assert.ok(
    hookSrc.includes("e.stopPropagation()") && hookSrc.includes("setPointerCapture"),
    "dragging the sheet cannot pan the map underneath",
  );
}
