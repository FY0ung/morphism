// Type-only shims for `bun run typecheck:scripts` (plain tsc). These declare
// ONLY the surface the pipeline actually uses — no runtime code, no new
// dependency. Upload still requires the real Bun runtime (guarded at runtime
// in build-flood-assets.ts via `process.versions.bun`).

declare module "bun" {
  /** Minimal Bun.S3Client surface used by scripts/build-flood-assets.ts.
   *  The call site narrows the instance to its own `S3ClientLike` anyway. */
  export class S3Client {
    constructor(options: {
      accessKeyId: string;
      secretAccessKey: string;
      endpoint: string;
      bucket: string;
      region?: string;
    });
    file(key: string): unknown;
  }
}

declare module "vt-pbf" {
  /** Minimal vt-pbf surface used by scripts/flood-tiles.ts. */
  const vtpbf: {
    fromGeojsonVt(
      layers: Record<string, unknown>,
      options?: { version?: number },
    ): Uint8Array;
  };
  export default vtpbf;
}
