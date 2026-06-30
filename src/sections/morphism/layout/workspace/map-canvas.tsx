"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { RefObject } from "react";

interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  ariaLabel: string;
}

/** The MapLibre render target. The map instance is owned by the view's hook. */
export default function MapCanvas({ containerRef, ariaLabel }: Props) {
  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={ariaLabel}
      className="absolute inset-0 size-full"
    />
  );
}
