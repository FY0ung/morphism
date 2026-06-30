"use client";

import React from "react";
import { motion } from "motion/react";

export type SpinnerSize = "xl" | "large" | "medium" | "small";

export interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  /** override สีเส้น spinner (ค่า default = primary) */
  colorClass?: string;
}

/* ---------------------------------------------------------
   SIZE MAP
--------------------------------------------------------- */
const sizeMap: Record<SpinnerSize, string> = {
  xl: "w-12 h-12",       // 48px
  large: "w-10 h-10",    // 40px
  medium: "w-8 h-8",     // 32px
  small: "w-6 h-6",      // 24px
};

/* ---------------------------------------------------------
   SPINNER (ใช้ SVG + strokeLinecap="round")
--------------------------------------------------------- */
export const Spinner: React.FC<SpinnerProps> = ({
  size = "medium",
  className,
  colorClass,
}) => {
  const strokeClass = colorClass ?? "stroke-background-primary-default";

  return (
    <motion.svg
      viewBox="0 0 48 48"
      className={`${sizeMap[size]} ${className ?? ""}`}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
    >
      <circle
        cx="24"
        cy="24"
        r="20"
        className="stroke-background-default-disable"
        strokeWidth="4"
        fill="none"
      />

      <circle
        cx="24"
        cy="24"
        r="20"
        className={strokeClass}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeDasharray="90 200"   
        strokeDashoffset="0"
      />
    </motion.svg>
  );
};
