# Manual regression checklist — Morphism

Run after every refactor round (`bun run dev`, both TH and EN where relevant).
Automated coverage lives in `tests/` (`bun run test`); this list covers what
needs eyes + a browser. In dev, `window.__morphismDiag.snapshot()` (console)
prints live resource counts — use it for the leak checks at the bottom.

> Queries are shown verbatim — type them exactly as written. Thai strings are
> deliberate: they exercise the Thai intent path, so do not translate them when
> testing. An English gloss follows each one.

## Hospital scenarios

- [ ] **"Show 24-hour hospitals in Bangkok"** (EN chip) — points in Bangkok
      only, camera frames Bangkok, zoom bands: summary < 6 → province counts
      6–8.5 → district counts 8.5–11 → points ≥ 11; popup opens on click.
- [ ] `แสดงโรงพยาบาลในกรุงเทพที่เปิด 24 ชั่วโมง` (TH chip — "show 24-hour
      hospitals in Bangkok") — same result.
- [ ] `โรงพยาบาลในจังหวัดเชียงใหม่มีกี่แห่ง` ("how many hospitals are in Chiang
      Mai province") — aggregate for Chiang Mai ONLY (one province highlighted,
      not the region); chat count == map label.
- [ ] Hospitals in Ayutthaya — `โรงพยาบาลในจังหวัดพระนครศรีอยุธยามีกี่แห่ง` —
      same as above.
- [ ] `โรงพยาบาลทั่วประเทศ` ("hospitals nationwide") — region badges
      nationwide; chat total == sum.
- [ ] `เปรียบเทียบโรงพยาบาลภาคเหนือกับภาคอีสาน` ("compare hospitals: North vs
      Northeast") — two region boundaries with region colours, ONE count label
      per region, donut matches labels.

## Flood scenarios

- [ ] `น้ำท่วม 13 ตุลาคม 2568` ("flooding on 13 October 2025", Buddhist-era
      year) — loads, camera fits extent once, legend shows the date, toast
      after camera settles; steps report real durations.
- [ ] `น้ำท่วมเดือนตุลาคม 2565` ("flooding in October 2022") — resolves to the
      month's latest snapshot and SAYS so; time pill shows the range.
- [ ] `น้ำท่วม 1 มกราคม 2560` ("flooding on 1 January 2017" — no data) —
      explicit empty state; previous map untouched.
- [ ] Date compare: `เปรียบเทียบน้ำท่วม 13 ตุลาคม 2568 กับ 14 ตุลาคม 2565`
      ("compare flooding 13 Oct 2025 vs 14 Oct 2022") — EXACT dates on both
      sides (not year datasets), divider works.
- [ ] Year compare: `เทียบน้ำท่วม 2565 กับ 2568` ("compare flooding 2022 vs
      2025") — annual cumulative datasets (pmtiles keys year-2022/year-2025),
      areas + donut plausible.

## Map behaviors

- [ ] Zoom overview → detail → overview (in/out across z 6.8) — flood stays
      visible in BOTH directions, no blank frame, no double-render.
- [ ] Compare: drag divider (smooth, no network in DevTools while dragging),
      keyboard arrows on the divider work, Escape closes.
- [ ] Close comparison → reopen from the chat card — works without reload;
      repeat open/close 10×, then check `__morphismDiag.snapshot()`:
      canvas count back to 1, map instances 1.
- [ ] Undo → redo across: flood date → hospitals → compare (scene steps back
      through real states).
- [ ] Theme dark ↔ light — basemap swaps, ALL custom layers survive (flood,
      boundaries, points, compare if open), colours re-read from tokens.
- [ ] Submit a new prompt while the previous flood query is still loading —
      old request superseded, no stale layer/camera from the old prompt,
      steps of the old message stop cleanly.
- [ ] Loading / empty / error / cancelled states: kill network (offline) and
      run a flood query → error pill, previous map kept; restore network and
      retry → works (errors are not cached).

## Presentation knowledge (must NOT touch the map)

- [ ] Ask "What is Morphism?", "What were the results?", "What is Constrained
      AI?" while a scenario is on screen — an answer appears, and the pill,
      legend, layers, camera and time filter are all unchanged.
- [ ] Repeat in TH (`Morphism คืออะไร`) and JP (`Morphismとは何ですか`) — the
      answer follows the selected language.
- [ ] Immediately after a knowledge question, run a real GIS query — it still
      resolves and renders normally.

## Leak / perf checks (dev only)

- [ ] `__morphismDiag.snapshot()` after 5 mixed scenarios ≈ same counts as
      after 1 (sources/layers stable, no runaway listeners/timers).
- [ ] No duplicate `/api/flood` or asset requests during zoom or divider drag
      (DevTools Network).
- [ ] Memory (DevTools Performance monitor) returns near baseline ~30 s after
      closing a comparison.
