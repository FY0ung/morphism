"use client";

import React from "react";

export type TagColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type TagVariant = "filled" | "outline";

export interface TagProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  color?: TagColor;
  variant?: TagVariant;
  size?: "extra-small" | "small";
}

export const Tag: React.FC<TagProps> = ({
  color = "primary",
  variant = "filled",
  size = "small",
  children,
  className,
  ...rest
}) => {
  const base =
    "inline-flex gap-2  items-center justify-center rounded-full whitespace-nowrap select-none";

  // 🎨 Filled
  const filledVariantClassMap: Record<TagColor, string> = {
    default:
      "bg-background-default-default text-text-default-default hover:bg-background-default-hover",
    primary:
      "bg-background-primary-light text-text-primary-onlight hover:bg-background-primary-light_active",
    secondary:
      "bg-background-secondary-light text-text-secondary-onlight hover:bg-background-secondary-light_active",
    success:
      "bg-background-success-light text-text-success-onlight hover:bg-background-success-light_active",
    warning:
      "bg-background-warning-light text-text-warning-onlight hover:bg-background-warning-light_active",
    danger:
      "bg-background-error-light text-text-error-onlight hover:bg-background-error-light_active",
    info:
      "bg-background-info-light text-text-info-onlight hover:bg-background-info-light_active",
  };

  // 🎨 Outline 
  const outlineVariantClassMap: Record<TagColor, string> = {
    default:
      "bg-background-default-light text-text-default-default border border-border-default-onlight hover:bg-background-default-light_active",
    primary:
      "bg-background-primary-light text-text-primary-onlight border border-border-primary-onlight hover:bg-background-primary-light_active",
    secondary:
      "bg-background-secondary-light text-text-secondary-onlight border border-border-secondary-onlight hover:bg-background-secondary-light_active",
    success:
      "bg-background-success-light text-text-success-onlight border border-border-success-onlight hover:bg-background-success-light_active",
    warning:
      "bg-background-warning-light text-text-warning-onlight border border-border-warning-onlight hover:bg-background-warning-light_active",
    danger:
      "bg-background-error-light text-text-error-onlight border border-border-error-onlight hover:bg-background-error-light_active",
    info:
      "bg-background-info-light text-text-info-onlight  border border-border-info-onlight hover:bg-background-info-light_active",
  };

  const colorClass =
    variant === "outline"
      ? outlineVariantClassMap[color]
      : filledVariantClassMap[color];

  // 📏 ขนาดของ Tag
  // extra-small = 24px height = h-6 px-2 text-xs
  // small       = 32px height = h-8 px-3 text-sm
  const sizeClass =
    size === "extra-small"
      ? "h-6 px-2 text-sm"
      : "h-8 px-3 text-sm"; // small

  return (
    <span
      className={`${base} ${colorClass} ${sizeClass} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </span>
  );
};
