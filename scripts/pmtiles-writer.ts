/**
 * pmtiles-writer.ts — minimal PMTiles v3 archive writer (build-time only).
 *
 * WHY hand-rolled: the official `pmtiles` npm package is read-only (reader +
 * MapLibre protocol); archive creation normally requires tippecanoe/go-pmtiles.
 * To keep the asset pipeline pure-TypeScript (no external binaries), this
 * implements exactly the subset of the v3 spec we need:
 *   • gzip'd MVT tiles, gzip'd internal directories
 *   • clustered layout (tiles written in ascending tileId order)
 *   • root directory + optional leaf directories (when root would overflow
 *     the 16 KB header+root budget)
 *
 * Tile IDs come from the SAME `zxyToTileId` the `pmtiles` reader uses, so the
 * writer can never disagree with the client about tile addressing.
 * Spec: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
 */
import { gzipSync } from "node:zlib";
import { zxyToTileId } from "pmtiles";

export interface TileInput {
  z: number;
  x: number;
  y: number;
  /** Raw (uncompressed) MVT bytes — the writer gzips them. */
  mvt: Uint8Array;
}

export interface PMTilesOptions {
  minZoom: number;
  maxZoom: number;
  /** [west, south, east, north] in degrees. */
  bounds: [number, number, number, number];
  /** [lng, lat, zoom]; defaults to the bounds' centre at minZoom+1. */
  center?: [number, number, number];
  /** Written as the archive's JSON metadata (vector_layers etc.). */
  metadata: Record<string, unknown>;
}

interface Entry {
  tileId: number;
  offset: number;
  length: number;
  runLength: number;
}

/** Varint (LEB128, unsigned) writer into a growable byte array. */
class ByteWriter {
  private buf: number[] = [];
  varint(nIn: number): void {
    let n = nIn;
    while (n >= 0x80) {
      this.buf.push((n & 0x7f) | 0x80);
      n = Math.floor(n / 128);
    }
    this.buf.push(n);
  }
  bytes(): Uint8Array {
    return Uint8Array.from(this.buf);
  }
}

/** Serialize a directory (spec §4: count, tileId deltas, runLengths, lengths,
 *  offsets-with-run-detection), then gzip it (internal_compression = gzip). */
function serializeDirectory(entries: Entry[]): Uint8Array {
  const w = new ByteWriter();
  w.varint(entries.length);
  let last = 0;
  for (const e of entries) {
    w.varint(e.tileId - last);
    last = e.tileId;
  }
  for (const e of entries) w.varint(e.runLength);
  for (const e of entries) w.varint(e.length);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const prev = entries[i - 1];
    if (i > 0 && prev && e.offset === prev.offset + prev.length) {
      w.varint(0); // contiguous with the previous entry
    } else {
      w.varint(e.offset + 1);
    }
  }
  return new Uint8Array(gzipSync(w.bytes(), { level: 9 }));
}

const HEADER_SIZE = 127;
/** Header + root directory must fit in the archive's first 16384 bytes. */
const ROOT_BUDGET = 16384 - HEADER_SIZE;
const LEAF_CHUNK = 4096; // entries per leaf when the root overflows

/** Build a complete PMTiles v3 archive from raw MVT tiles. */
export function buildPMTiles(tiles: TileInput[], opts: PMTilesOptions): Uint8Array {
  if (!tiles.length) throw new Error("buildPMTiles: no tiles");

  // ── tile data section (clustered: ascending tileId) ───────────────────────
  const withIds = tiles
    .map((t) => ({ tileId: zxyToTileId(t.z, t.x, t.y), t }))
    .sort((a, b) => a.tileId - b.tileId);

  const tileChunks: Uint8Array[] = [];
  const entries: Entry[] = [];
  let tileOffset = 0;
  for (const { tileId, t } of withIds) {
    const gz = new Uint8Array(gzipSync(t.mvt, { level: 9 }));
    entries.push({ tileId, offset: tileOffset, length: gz.byteLength, runLength: 1 });
    tileChunks.push(gz);
    tileOffset += gz.byteLength;
  }
  const tileData = concat(tileChunks);

  // ── directories: root only when it fits, else root→leaves ─────────────────
  let rootDir = serializeDirectory(entries);
  // Widened annotation: `concat` returns Uint8Array<ArrayBufferLike>, which a
  // bare `new Uint8Array(0)` (Uint8Array<ArrayBuffer>) won't accept under
  // TS 5.9 typed-array generics. Type-only; no behaviour change.
  let leafData: Uint8Array = new Uint8Array(0);
  if (rootDir.byteLength > ROOT_BUDGET) {
    const leafChunks: Uint8Array[] = [];
    const rootEntries: Entry[] = [];
    let leafOffset = 0;
    for (let i = 0; i < entries.length; i += LEAF_CHUNK) {
      const slice = entries.slice(i, i + LEAF_CHUNK);
      const leaf = serializeDirectory(slice);
      rootEntries.push({
        tileId: slice[0].tileId,
        offset: leafOffset,
        length: leaf.byteLength,
        runLength: 0, // runLength 0 ⇒ this entry points at a leaf directory
      });
      leafChunks.push(leaf);
      leafOffset += leaf.byteLength;
    }
    leafData = concat(leafChunks);
    rootDir = serializeDirectory(rootEntries);
    if (rootDir.byteLength > ROOT_BUDGET) {
      throw new Error(
        `buildPMTiles: root directory still ${rootDir.byteLength} B after leaf split`,
      );
    }
  }

  const metadata = new Uint8Array(
    gzipSync(new TextEncoder().encode(JSON.stringify(opts.metadata)), { level: 9 }),
  );

  // ── layout: header · root · metadata · leaves · tiles ─────────────────────
  const rootOffset = HEADER_SIZE;
  const metadataOffset = rootOffset + rootDir.byteLength;
  const leafOffset = metadataOffset + metadata.byteLength;
  const tileDataOffset = leafOffset + leafData.byteLength;

  const header = new Uint8Array(HEADER_SIZE);
  const view = new DataView(header.buffer);
  const magic = "PMTiles";
  for (let i = 0; i < magic.length; i++) header[i] = magic.charCodeAt(i);
  header[7] = 3; // spec version
  const u64 = (at: number, value: number) => view.setBigUint64(at, BigInt(value), true);
  u64(8, rootOffset);
  u64(16, rootDir.byteLength);
  u64(24, metadataOffset);
  u64(32, metadata.byteLength);
  u64(40, leafOffset);
  u64(48, leafData.byteLength);
  u64(56, tileDataOffset);
  u64(64, tileData.byteLength);
  u64(72, entries.length); // addressed tiles
  u64(80, entries.length); // tile entries
  u64(88, entries.length); // tile contents (no dedupe)
  header[96] = 1; // clustered
  header[97] = 2; // internal compression: gzip
  header[98] = 2; // tile compression: gzip
  header[99] = 1; // tile type: MVT
  header[100] = opts.minZoom;
  header[101] = opts.maxZoom;
  const e7 = (deg: number) => Math.round(deg * 1e7);
  const [w, s, e, n] = opts.bounds;
  view.setInt32(102, e7(w), true);
  view.setInt32(106, e7(s), true);
  view.setInt32(110, e7(e), true);
  view.setInt32(114, e7(n), true);
  const center = opts.center ?? [(w + e) / 2, (s + n) / 2, opts.minZoom + 1];
  header[118] = Math.round(center[2]);
  view.setInt32(119, e7(center[0]), true);
  view.setInt32(123, e7(center[1]), true);

  return concat([header, rootDir, metadata, leafData, tileData]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.byteLength;
  }
  return out;
}
