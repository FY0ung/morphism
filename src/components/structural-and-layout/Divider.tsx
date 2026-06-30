"use client";

import React from "react";

export type DividerOrientation = "horizontal" | "vertical";

export interface DividerProps {
  orientation?: DividerOrientation;
  dashed?: boolean;                
  className?: string;               
}

export const Divider: React.FC<DividerProps> = ({
  orientation = "horizontal",
  dashed = false,
  className,
}) => {
  const isHorizontal = orientation === "horizontal";

  const base =
    "shrink-0 border-border-default-default";

  const directionClass = isHorizontal
    ? "w-full mt-2 border-t"
    : "h-full border-l";

  const styleClass = dashed ? "border-dashed" : "border-solid";

  return (
    <div
      className={`${base} ${directionClass} ${styleClass} ${
        className ?? ""
      }`}
    />
  );
};
