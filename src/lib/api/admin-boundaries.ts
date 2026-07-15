import { endpoint } from "@/configs/endpoint";
import { sanitizeFeatureCollection, stripThaiAdminPrefix } from "@/lib/normalize";
import type { AdmFC, AdmLevel } from "@/types";

// Multi-level administrative boundaries, lazy-loaded from the SAME open datasets
// the HTML reference uses (chingchai/OpenGISData-Thailand). Mirrors the HTML's
// `loadAdm()`: module-level cache + in-flight dedupe, normalize on first load,
// resolve to null on failure (callers fall back to province aggregation).

// Fetched + normalized results (fetch once, reuse forever within the session).
const admCache = new Map<AdmLevel, AdmFC>();
// In-flight promises so concurrent callers never trigger a duplicate request.
const admLoading = new Map<AdmLevel, Promise<AdmFC | null>>();

const str = (v: unknown): string | undefined =>
  v == null ? undefined : String(v);

/** Normalize chingchai props → { name, pro_code, amp_code } (mirrors normAdm).
 *  Invalid features are skipped safely; names lose Thai admin prefixes so the
 *  canonical name joins across datasets. */
function normalize(level: AdmLevel, raw: unknown): AdmFC {
  const { fc } = sanitizeFeatureCollection<AdmFC["features"][number]["properties"]>(
    raw,
    `adm-${level}`,
    (p) => {
      const name =
        (level === "ADM1"
          ? (p.pro_th ?? p.name)
          : level === "ADM2"
            ? (p.amp_th ?? p.name)
            : (p.tam_th ?? p.name)) ?? "";
      return {
        name: stripThaiAdminPrefix(String(name)),
        pro_code: str(p.pro_code),
        amp_code: str(p.amp_code),
      };
    },
  );
  return fc;
}

/**
 * Load one admin level (cached + deduped). Resolves to null on any failure so
 * the caller can gracefully fall back to the existing province aggregation.
 */
export function getAdmBoundaries(level: AdmLevel): Promise<AdmFC | null> {
  const cached = admCache.get(level);
  if (cached) return Promise.resolve(cached);
  const inFlight = admLoading.get(level);
  if (inFlight) return inFlight;

  const req = fetch(endpoint.boundaries.adm[level])
    .then((r) => {
      if (!r.ok) throw new Error(`adm ${level} fetch failed: ${r.status}`);
      return r.json() as Promise<unknown>;
    })
    .then((raw) => {
      const fc = normalize(level, raw);
      admCache.set(level, fc);
      admLoading.delete(level);
      return fc;
    })
    .catch(() => {
      admLoading.delete(level); // allow a later retry
      return null;
    });

  admLoading.set(level, req);
  return req;
}
