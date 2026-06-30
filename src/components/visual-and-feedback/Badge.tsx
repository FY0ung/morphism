// src/components/visual-and-feedback/Badge.tsx
"use client";

import React from "react";

export type BadgeColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type BadgeVariant =
  | "dot"            
  | "single"         
  | "multiple"      
  | "max";           

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  color?: BadgeColor;
  variant?: BadgeVariant;
  value?: number | string;
  max?: number;
}

export const Badge: React.FC<BadgeProps> = ({
  color = "primary",
  variant = "multiple",
  value,
  max = 99,
  className,
  ...rest
}) => {
  const base =
    "inline-flex items-center justify-center rounded-full text-xs select-none";

  const colorClassMap: Record<BadgeColor, string> = {
    default:
      "bg-background-default-light text-text-default-default",
    primary:
      "bg-background-primary-default text-text-primary-default",
    secondary:
      "bg-background-secondary-default text-text-secondary-default",
    success:
      "bg-background-success-default text-text-success-default",
    warning:
      "bg-background-warning-default text-text-warning-default",
    danger:
      "bg-background-error-default text-text-error-default",
    info:
      "bg-background-info-default text-text-info-default",
  };

  const colorClass = colorClassMap[color];

  // คำนวณค่าที่จะแสดงบน badge
  let displayValue: React.ReactNode = value;

  if (variant === "max" && typeof value === "number") {
    displayValue = value > max ? `${max}+` : value;
  }

  // ขนาดแต่ละ variant
  if (variant === "dot") {
    return (
      <span
        className={`${base} ${colorClass} w-2 h-2 ${className ?? ""}`}
        {...rest}
      />
    );
  }

  if (variant === "single") {
    return (
      <span
        className={`${base} ${colorClass} w-3.5 h-3.5 px-1 py-0.5 text-xs leading-none ${className ?? ""}`}
        {...rest}
      >
        {displayValue}
      </span>
    );
  }

  // multiple & max
  return (
    <span
      className={`${base} ${colorClass} w-auto h-3.5 px-1 py-0.5 text-xs leading-none ${className ?? ""}`}
      {...rest}
    >
      {displayValue}
    </span>
  );
};
