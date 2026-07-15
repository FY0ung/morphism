"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface Props {
  /** Show the overlay (a flood scenario is fetching / committing / framing). */
  active: boolean;
}

/**
 * Map loading state. While a flood scenario downloads its data and the camera
 * flies to the new extent, the CARTO vector basemap briefly paints its blank
 * near-white background (tiles for the new region are still streaming). This
 * covers that flash with an intentional, themed loading state — the map is
 * revealed atomically once the data + tiles are ready.
 *
 * The spinner is a gooey "metaball": primary-token blobs that merge and split.
 * It uses an SVG goo filter (blur → `feColorMatrix` alpha contrast) rather than
 * the CSS `blur + contrast` trick, because CSS contrast forces every channel to
 * an extreme and blows a light primary out to white (invisible). The SVG filter
 * sharpens ALPHA only, so the blobs keep their exact primary fill. Colours come
 * from design tokens; honours prefers-reduced-motion (blobs settle, no motion).
 *
 * `aria-hidden` while idle; a polite live region announces loading to AT.
 */
export default function MapLoadingOverlay({ active }: Props) {
  const { t } = useTranslation();
  return (
    <div
      aria-hidden={!active}
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background-default-default/70 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none",
        active ? "opacity-100" : "opacity-0",
      )}
    >
      <style>{`
        .morphism-goo { filter: url(#morphism-goo); }
        .morphism-goo span {
          position: absolute;
          top: 50%;
          left: 50%;
          border-radius: 9999px;
          background: var(--color-background-primary-default);
        }
        .morphism-goo .b-core { width: 30px; height: 30px; margin: -15px 0 0 -15px; }
        .morphism-goo .b-a { width: 18px; height: 18px; margin: -9px 0 0 -9px; animation: morphism-goo-a 1.3s ease-in-out infinite; }
        .morphism-goo .b-b { width: 18px; height: 18px; margin: -9px 0 0 -9px; animation: morphism-goo-b 1.3s ease-in-out infinite; }
        @keyframes morphism-goo-a {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(-22px, -15px); }
        }
        @keyframes morphism-goo-b {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(22px, 15px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .morphism-goo .b-a, .morphism-goo .b-b { animation: none; }
        }
      `}</style>

      <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
        <defs>
          <filter id="morphism-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9"
            />
          </filter>
        </defs>
      </svg>

      <div className="flex flex-col items-center gap-4">
        <span className="relative block size-16">
          <span className="morphism-goo absolute inset-0 block">
            <span className="b-core" />
            <span className="b-a" />
            <span className="b-b" />
          </span>
        </span>
        <span className="text-sm font-medium text-text-default-onlight">
          {active ? t("morphism.flood.loadingMap") : null}
        </span>
      </div>
    </div>
  );
}
