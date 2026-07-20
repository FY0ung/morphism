// DEV-ONLY resource diagnostics. Compiled away in production (every entry
// point checks NODE_ENV first and the registry stays empty), zero overhead on
// the hot paths — registration happens only on create/destroy events.
//
// Console usage (dev):   window.__morphismDiag.snapshot()
//
// Tracks: live MapLibre instances (main + compare overlay), canvas/WebGL
// counts, style source/layer counts per map, in-flight request controllers,
// client cache sizes, and named listeners/timers that opt in via track().

type MaplibreMap = import("maplibre-gl").Map;

const DEV = process.env.NODE_ENV !== "production";

interface Snapshot {
  maps: { label: string; sources: number; layers: number }[];
  canvases: number;
  webglContexts: number;
  inflight: Record<string, number>;
  caches: Record<string, number>;
  tracked: Record<string, number>;
}

const maps = new Map<string, MaplibreMap>();
const inflightCounters = new Map<string, () => number>();
const cacheCounters = new Map<string, () => number>();
const tracked = new Map<string, number>();

/** Register a live map instance (call on create; unregister on remove). */
export function diagRegisterMap(label: string, map: MaplibreMap): void {
  if (!DEV) return;
  maps.set(label, map);
}
export function diagUnregisterMap(label: string): void {
  if (!DEV) return;
  maps.delete(label);
}

/** Expose a live counter (in-flight requests, cache size) by name. */
export function diagCounter(
  kind: "inflight" | "cache",
  name: string,
  read: () => number,
): void {
  if (!DEV) return;
  (kind === "inflight" ? inflightCounters : cacheCounters).set(name, read);
}

/** Count named resources that lack a queryable registry (listeners, timers,
 *  observers): call with +1 on create and -1 on cleanup. */
export function diagTrack(name: string, delta: 1 | -1): void {
  if (!DEV) return;
  tracked.set(name, (tracked.get(name) ?? 0) + delta);
}

function snapshot(): Snapshot {
  const mapRows = [...maps.entries()].map(([label, m]) => {
    let sources = 0;
    let layers = 0;
    try {
      const style = m.getStyle();
      sources = Object.keys(style?.sources ?? {}).length;
      layers = style?.layers?.length ?? 0;
    } catch {
      /* style mid-swap — counts unavailable this tick */
    }
    return { label, sources, layers };
  });
  const read = (src: Map<string, () => number>) =>
    Object.fromEntries([...src.entries()].map(([k, f]) => [k, f()]));
  return {
    maps: mapRows,
    canvases: document.querySelectorAll("canvas").length,
    webglContexts: document.querySelectorAll(".maplibregl-canvas").length,
    inflight: read(inflightCounters),
    caches: read(cacheCounters),
    tracked: Object.fromEntries(
      [...tracked.entries()].filter(([, v]) => v !== 0),
    ),
  };
}

// Install the console handle once (client + dev only).
if (DEV && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__morphismDiag = {
    snapshot,
    /** DEV-ONLY: direct map handle for console probing (paint/layout). */
    getMap: (label = "main") => maps.get(label),
  };
}
