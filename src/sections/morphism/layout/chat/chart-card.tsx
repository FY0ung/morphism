"use client";

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { exportChartCSV, exportSvgPNG } from "@/lib/chart-export";
import type { ChartData } from "@/types";

interface Props {
  chart: ChartData;
}

const BAR_H = 18;
const GAP = 16;
const LABEL_W = 104;
const VALUE_W = 40;

// Token-only slice palette (fill for the SVG arc, matching legend swatch).
const DONUT_PALETTE = [
  "fill-background-primary-default",
  "fill-background-info-default",
  "fill-background-success-default",
  "fill-background-warning-default",
];

/** SVG arc path for one donut slice (angles in radians, 0 = 12 o'clock). */
function donutSlice(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  a0: number,
  a1: number,
): string {
  const p = (r: number, a: number) => [
    cx + r * Math.sin(a),
    cy - r * Math.cos(a),
  ];
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [ox0, oy0] = p(rOuter, a0);
  const [ox1, oy1] = p(rOuter, a1);
  const [ix1, iy1] = p(rInner, a1);
  const [ix0, iy0] = p(rInner, a0);
  return `M${ox0},${oy0} A${rOuter},${rOuter} 0 ${large} 1 ${ox1},${oy1} L${ix1},${iy1} A${rInner},${rInner} 0 ${large} 0 ${ix0},${iy0} Z`;
}

/** Inline horizontal bar chart (Highcharts-style) with CSV / PNG export.
 *  Clean tokenised dark styling — readable default text, subtle track, no grid
 *  clutter. */
export default function ChartCard({ chart }: Props) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const max = Math.max(1, ...chart.rows.map((r) => r.value));
  const width = 320;
  const innerW = width - LABEL_W - VALUE_W;
  const barHeight = chart.rows.length * (BAR_H + GAP) + GAP;
  const title = t(chart.title as "morphism.chartCompareTitle");

  const isDonut = chart.kind === "donut";
  const donutTotal = chart.rows.reduce((s, r) => s + r.value, 0);
  const dCx = 82;
  const dCy = 95;
  const dRo = 62;
  const dRi = 40;
  const donutHeight = 190;
  // Precompute slice angles via prefix sums (no post-render mutation).
  const fracs = chart.rows.map((r) =>
    donutTotal > 0 ? r.value / donutTotal : 0,
  );
  const slices = chart.rows.map((row, i) => {
    const start = fracs.slice(0, i).reduce((s, f) => s + f, 0);
    const frac = fracs[i];
    const a0 = start * 2 * Math.PI;
    const a1 = (start + frac) * 2 * Math.PI;
    return {
      row,
      d: donutSlice(dCx, dCy, dRo, dRi, a0, a1),
      // Per-row token colour when supplied (e.g. flood year-compare), else the
      // default rotating token palette.
      color: row.swatch ?? DONUT_PALETTE[i % DONUT_PALETTE.length],
      pct: Math.round(frac * 1000) / 10,
    };
  });

  return (
    <figure className="mt-3 rounded-xl border border-border-default-default bg-background-default-default p-3">
      <figcaption className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-default-default">
          {title}
        </span>
        <span className="flex gap-1.5">
          <button
            type="button"
            onClick={() =>
              exportChartCSV(chart.rows, `${chart.exportName}.csv`, [
                t("morphism.chartCsvHeaderLabel"),
                t("morphism.chartCsvHeaderValue"),
              ])
            }
            className="inline-flex h-7 items-center gap-1 rounded-full border border-border-default-onlight px-3 text-[11px] font-semibold text-text-default-onlight transition-colors hover:border-border-primary-default hover:bg-background-primary-light hover:text-text-primary-onlight"
          >
            <Icon name="Download01" className="size-3" />
            {t("morphism.exportCsv")}
          </button>
          <button
            type="button"
            onClick={() =>
              svgRef.current &&
              exportSvgPNG(svgRef.current, `${chart.exportName}.png`)
            }
            className="inline-flex h-7 items-center gap-1 rounded-full border border-border-default-onlight px-3 text-[11px] font-semibold text-text-default-onlight transition-colors hover:border-border-primary-default hover:bg-background-primary-light hover:text-text-primary-onlight"
          >
            <Icon name="Image01" className="size-3" />
            {t("morphism.exportPng")}
          </button>
        </span>
      </figcaption>

      {isDonut ? (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${donutHeight}`}
          width="100%"
          role="img"
          aria-label={title}
          className="overflow-visible"
        >
          {/* donut slices */}
          {slices.map((s) => (
            <path key={s.row.label} d={s.d} className={s.color} />
          ))}
          {/* center total */}
          <text
            x={dCx}
            y={dCy - 6}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-text-default-default text-[15px] font-semibold"
          >
            {donutTotal.toLocaleString()}
          </text>
          {chart.centerLabel && (
            <text
              x={dCx}
              y={dCy + 12}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-text-secondary-onlight text-[10px]"
            >
              {chart.centerLabel}
            </text>
          )}
          {/* legend */}
          {slices.map((s, i) => {
            const ly = 44 + i * 26;
            return (
              <g key={`lg-${s.row.label}`}>
                <rect
                  x={172}
                  y={ly}
                  width={12}
                  height={12}
                  rx={3}
                  className={s.color}
                />
                <text
                  x={190}
                  y={ly + 6}
                  dominantBaseline="central"
                  className="fill-text-default-default text-[12px]"
                >
                  {s.row.label}
                </text>
                <text
                  x={width}
                  y={ly + 6}
                  textAnchor="end"
                  dominantBaseline="central"
                  className="fill-text-default-default text-[12px] font-semibold"
                >
                  {s.row.value.toLocaleString()} ({s.pct}%)
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${barHeight}`}
          width="100%"
          role="img"
          aria-label={title}
          className="overflow-visible"
        >
          {chart.rows.map((row, i) => {
            const y = GAP + i * (BAR_H + GAP);
            const w = Math.max(3, (row.value / max) * innerW);
            return (
              <g key={row.label}>
                {/* category label (readable) */}
                <text
                  x={0}
                  y={y + BAR_H / 2}
                  dominantBaseline="central"
                  className="fill-text-default-default text-[12px]"
                >
                  {row.label}
                </text>
                {/* subtle full-width track */}
                <rect
                  x={LABEL_W}
                  y={y}
                  width={innerW}
                  height={BAR_H}
                  rx={BAR_H / 2}
                  className="fill-background-default-light"
                />
                {/* value bar */}
                <rect
                  x={LABEL_W}
                  y={y}
                  width={w}
                  height={BAR_H}
                  rx={BAR_H / 2}
                  className={row.swatch ?? "fill-background-primary-default"}
                />
                {/* value label */}
                <text
                  x={LABEL_W + innerW + VALUE_W - 2}
                  y={y + BAR_H / 2}
                  textAnchor="end"
                  dominantBaseline="central"
                  className="fill-text-default-default text-[12px] font-semibold"
                >
                  {row.value.toLocaleString()}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {/* screen-reader data table */}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {chart.rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
