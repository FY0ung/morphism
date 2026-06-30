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

/** Inline horizontal bar chart (Highcharts-style) with CSV / PNG export.
 *  Clean tokenised dark styling — readable default text, subtle track, no grid
 *  clutter. */
export default function ChartCard({ chart }: Props) {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const max = Math.max(1, ...chart.rows.map((r) => r.value));
  const width = 320;
  const innerW = width - LABEL_W - VALUE_W;
  const height = chart.rows.length * (BAR_H + GAP) + GAP;
  const title = t(chart.title as "morphism.chartCompareTitle");

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

      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
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
                className="fill-background-primary-default"
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
