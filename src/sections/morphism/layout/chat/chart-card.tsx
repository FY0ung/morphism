"use client";

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";
import { IconButton } from "@/components/actionable/IconButtons";
import { Dropdown } from "@/components/selection/DropdownMenu";
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
  // Colour-vision aware data-series roles (globals.css): default mode
  // aliases the original primary/info/success/warning tokens exactly.
  "fill-data-series-1",
  "fill-data-series-2",
  "fill-data-series-3",
  "fill-data-series-4",
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

  // Charts with a unit compare INDEPENDENT absolute magnitudes (e.g. flooded
  // area A vs B, millions of rai). They use a full-width horizontal bar per row
  // — label above-left, exact value above-right, bar underneath — so long
  // TH/JP labels and 7-digit values never overlap or clip in the narrow chat
  // panel. No percentages, no combined total: bars share ONE scale (max =
  // largest value), which is what makes the lengths directly comparable.
  const isWideBar = !isDonut && Boolean(chart.unit);
  const unitSuffix = chart.unit ? ` ${chart.unit}` : "";
  const fmt = (v: number) => `${v.toLocaleString()}${unitSuffix}`;
  const WIDE_ROW_H = 44;
  const WIDE_BAR_H = 14;
  const wideHeight = chart.rows.length * WIDE_ROW_H;
  // "Flooded area comparison: 2565 — 3,824,248 rai; 2568 — 2,713,219 rai."
  const description = `${title}: ${chart.rows
    .map((r) => `${r.label} — ${fmt(r.value)}`)
    .join("; ")}`;
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
        {/* ONE compact export action → dropdown (Download CSV / PNG). Keeps the
            card header quiet — the two old pill buttons competed with the title. */}
        <Dropdown.Root>
          <Dropdown.Trigger>
            {(open) => (
              <IconButton
                type="button"
                variant="text"
                color="default"
                size="small"
                aria-label={t("morphism.exportMenu")}
                aria-haspopup="menu"
                aria-expanded={open}
                className="-my-1 focus-visible:outline-2 focus-visible:outline-border-primary-default"
              >
                <Icon name="DotsVertical" className="size-4" />
              </IconButton>
            )}
          </Dropdown.Trigger>
          <Dropdown.Content align="end">
            <Dropdown.Item
              item={t("morphism.exportCsv")}
              iconStart={
                <Icon
                  name="Download01"
                  className="size-4 text-text-default-onlight"
                />
              }
              onClick={() =>
                exportChartCSV(chart.rows, `${chart.exportName}.csv`, [
                  t("morphism.chartCsvHeaderLabel"),
                  t("morphism.chartCsvHeaderValue"),
                ])
              }
            />
            <Dropdown.Item
              item={t("morphism.exportPng")}
              iconStart={
                <Icon
                  name="Image01"
                  className="size-4 text-text-default-onlight"
                />
              }
              onClick={() =>
                svgRef.current &&
                exportSvgPNG(svgRef.current, `${chart.exportName}.png`)
              }
            />
          </Dropdown.Content>
        </Dropdown.Root>
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
          {/* legend — label on top, value+pct on the line below so large real
              numbers (millions of rai) never collide with the label. */}
          {slices.map((s, i) => {
            const ly = 40 + i * 48;
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
                  className="fill-text-default-onlight text-[12px]"
                >
                  {s.row.label}
                </text>
                <text
                  x={172}
                  y={ly + 27}
                  dominantBaseline="central"
                  className="fill-text-default-default text-[13px] font-semibold"
                >
                  {s.row.value.toLocaleString()} ({s.pct}%)
                </text>
              </g>
            );
          })}
        </svg>
      ) : isWideBar ? (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${wideHeight}`}
          width="100%"
          role="img"
          aria-label={description}
          className="overflow-visible"
        >
          {chart.rows.map((row, i) => {
            const y = i * WIDE_ROW_H;
            const barY = y + 20;
            // Shared scale across rows → a larger value ALWAYS draws a longer
            // bar. Min 2px so a non-zero value stays visible.
            const w = row.value > 0 ? Math.max(2, (row.value / max) * width) : 0;
            return (
              <g key={row.label}>
                {/* period / year label */}
                <text
                  x={0}
                  y={y + 8}
                  dominantBaseline="central"
                  className="fill-text-default-onlight text-[12px]"
                >
                  {row.label}
                </text>
                {/* exact value + localized unit, right-aligned (never clipped) */}
                <text
                  x={width}
                  y={y + 8}
                  textAnchor="end"
                  dominantBaseline="central"
                  className="fill-text-default-default text-[12px] font-semibold"
                >
                  {fmt(row.value)}
                </text>
                {/* subtle shared-scale track (no grid lines / borders) */}
                <rect
                  x={0}
                  y={barY}
                  width={width}
                  height={WIDE_BAR_H}
                  rx={WIDE_BAR_H / 2}
                  className="fill-background-default-light"
                />
                {/* value bar — colour comes from the centralized data palette */}
                <rect
                  x={0}
                  y={barY}
                  width={w}
                  height={WIDE_BAR_H}
                  rx={WIDE_BAR_H / 2}
                  className={row.swatch ?? "fill-data-series-1"}
                />
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
                  className={row.swatch ?? "fill-data-series-1"}
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

      {/* screen-reader data table — exact values (with unit), never colour or
          bar length alone. */}
      <table className="sr-only">
        <caption>{description}</caption>
        <tbody>
          {chart.rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{chart.unit ? fmt(r.value) : r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
