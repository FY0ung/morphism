// src/components/actionable/Button.tsx
"use client";

import React from "react";

export type ButtonColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type ButtonVariant = "filled" | "text";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: ButtonColor;            // สี
  variant?: ButtonVariant;      // สไตล์: filled / text
  size?: "large" | "medium" | "small";
}

export const Button: React.FC<ButtonProps> = ({
  color = "primary",
  variant = "filled",
  size = "medium",
  children,
  className,
  ...rest
}) => {
  const base =
    "inline-flex text-nowrap gap-2 items-center justify-center rounded-full";

  // 🎨 สีปุ่มแบบ Filled (ของเดิม)
  const filledVariantClassMap: Record<ButtonColor, string> = {
    default:
      "bg-background-default-default text-text-default-default hover:bg-background-default-hover cursor-pointer",
    primary:
      "bg-background-primary-default text-text-primary-default hover:bg-background-primary-hover cursor-pointer",
    secondary:
      "bg-background-secondary-default text-text-secondary-default hover:bg-background-secondary-hover cursor-pointer",
    success:
      "bg-background-success-default text-text-success-default hover:bg-background-success-hover cursor-pointer",
    warning:
      "bg-background-warning-default text-text-warning-default hover:bg-background-warning-hover cursor-pointer",
    danger:
      "bg-background-error-default text-text-error-default hover:bg-background-error-hover cursor-pointer",
    info:
      "bg-background-info-default text-text-info-default hover:bg-background-info-hover cursor-pointer",
  };

  // ✏️ สีปุ่มแบบ Text (ไม่มีพื้นหลัง เน้นสีตัวอักษร)
  const textVariantClassMap: Record<ButtonColor, string> = {
    default:
      "bg-transparent text-text-default-default hover:bg-background-default-light_hover cursor-pointer",
    primary:
      "bg-transparent text-text-primary-onlight hover:bg-background-primary-light_hover cursor-pointer",
    secondary:
      "bg-transparent text-text-secondary-onlight hover:bg-background-secondary-light_hover cursor-pointer",
    success:
      "bg-transparent text-text-success-onlight hover:bg-background-success-light_hover cursor-pointer",
    warning:
      "bg-transparent text-text-warning-onlight hover:bg-background-warning-light_hover cursor-pointer",
    danger:
      "bg-transparent text-text-error-onlight hover:bg-background-error-light_hover cursor-pointer",
    info:
      "bg-transparent text-text-info-onlight hover:bg-background-info-light_hover cursor-pointer",
  };

  const colorClass =
    variant === "text"
      ? textVariantClassMap[color]
      : filledVariantClassMap[color];

  // 📏 ขนาดปุ่ม
  // large  = 48px (h-12)
  // medium = 40px (h-10)
  // small  = 32px (h-8)
  const sizeClass =
    size === "large"
      ? "h-12 px-5 text-sm"
      : size === "small"
      ? "h-8 px-3 text-sm"
      : "h-10 px-4 text-sm"; // medium

  return (
    <button
      className={`${base} ${colorClass} ${sizeClass} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </button>
  );
};
