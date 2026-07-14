"use client";

// PMTiles protocol registration — exactly ONCE per app lifecycle, no matter
// how many maps (main + compare overlay) are created or how often compare
// opens/closes. Both map hooks call this right after importing maplibre-gl.
import { Protocol } from "pmtiles";

type MaplibreModule = {
  addProtocol: (scheme: string, handler: Protocol["tile"]) => void;
};

let registered = false;

export function ensurePmtilesProtocol(maplibregl: MaplibreModule): void {
  if (registered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);
  registered = true;
}
