// Map presentation config — the ONE place basemap style URLs and the initial
// camera live. Hooks (main map + compare overlay) import from here; nothing
// else should re-declare these URLs. Swapping the basemap provider or start
// location for another deployment = edit THIS file only.

// CARTO vector basemaps (carry their own sources/glyphs/sprite).
export const DARK_BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
export const LIGHT_BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
// Backwards-compatible default (dark) — also used by the swipe overlay map.
export const BASEMAP_STYLE = DARK_BASEMAP_STYLE;

/** UI theme → basemap style URL (undefined theme = dark, the app default). */
export const basemapStyleFor = (theme?: string): string =>
  theme === "light" ? LIGHT_BASEMAP_STYLE : DARK_BASEMAP_STYLE;

// Initial camera — matches the HTML reference (central Bangkok).
export const INITIAL_CENTER: [number, number] = [100.53, 13.745];
export const INITIAL_ZOOM = 11.4;
