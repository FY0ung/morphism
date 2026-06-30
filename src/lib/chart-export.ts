// Client-side export helpers for chart cards (CSV + PNG).
import type { ChartRow } from "@/types";

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Export chart rows as a CSV file. */
export function exportChartCSV(
  rows: ChartRow[],
  filename: string,
  header: [string, string] = ["label", "value"],
): void {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    `${escape(header[0])},${escape(header[1])}`,
    ...rows.map((r) => `${escape(r.label)},${r.value}`),
  ];
  downloadBlob(
    new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }),
    filename,
  );
}

/** Rasterise an inline <svg> chart to a PNG download. */
export function exportSvgPNG(svg: SVGSVGElement, filename: string): void {
  const serialized = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([serialized], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = svg.clientWidth * scale || img.width * scale;
    canvas.height = svg.clientHeight * scale || img.height * scale;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, filename);
      }, "image/png");
    }
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
