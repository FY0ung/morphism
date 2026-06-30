"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ProgressBarProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0–100
  showLabel?: boolean;
  size?: "small" | "medium" | "large";
  color?: "primary" | "secondary" | "success" | "warning" | "error";
  animated?: boolean; // แค่เปิด/ปิด transition
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  showLabel = true,
  size = "medium",
  color = "primary",
  animated = true,
  className,
  ...rest
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  const sizeHeight: Record<NonNullable<ProgressBarProps["size"]>, string> = {
    small: "h-1.5",
    medium: "h-2",
    large: "h-3",
  };

  // ใช้สีที่มองเห็นแน่นอนก่อน ถ้าอยากผูกกับ design token ค่อยเปลี่ยนทีหลัง
  const colorClass: Record<NonNullable<ProgressBarProps["color"]>, string> = {
    primary: "bg-background-primary-default",
    secondary: "bg-gray-400",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
  };

  return (
    <div
      className={cn("flex items-center gap-2 w-full", className)}
      {...rest}
    >
      {/* Track */}
      <div
        className={cn(
          "w-full rounded-full bg-background-default-disable overflow-hidden",
          sizeHeight[size]
        )}
      >
        {/* Fill */}
        <div
          className={cn(
            "h-full rounded-full",
            colorClass[color],
            animated && "transition-[width] duration-500 ease-out"
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>

      {/* Label */}
      {showLabel && (
        <span className="text-xs text-text-default-default tabular-nums w-10 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
};
