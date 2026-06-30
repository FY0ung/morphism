// src/components/actionable/Button.tsx
"use client";

import React from "react";

export type IconButtonColor =
  | "default"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info";

export type IconButtonVariant = "filled" | "text";

export interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: IconButtonColor;
  variant?: IconButtonVariant;
  size?: "large" | "medium" | "small";
}

export const IconButton: React.FC<IconButtonProps> = ({
  color = "primary",
  variant = "filled",
  size = "medium",
  children,
  className,
  ...rest
}) => {
  const base =
    "inline-flex items-center justify-center font-medium rounded-full";

  // 🎨 สีปุ่มแบบ Filled (ของเดิม)
  const filledVariantClassMap: Record<IconButtonColor, string> = {
    default:
      "bg-background-default-light text-text-default-default transition-colors hover:bg-background-default-light_hover cursor-pointer",
    primary:
      "bg-background-primary-default text-text-primary-default transition-colors hover:bg-background-primary-hover cursor-pointer",
    secondary:
      "bg-background-secondary-default text-text-secondary-default transition-colors hover:bg-background-secondary-hover cursor-pointer",
    success:
      "bg-background-success-default text-text-success-default transition-colors hover:bg-background-success-hover cursor-pointer",
    warning:
      "bg-background-warning-default text-text-warning-default transition-colors hover:bg-background-warning-hover cursor-pointer",
    danger:
      "bg-background-error-default text-text-error-default transition-colors hover:bg-background-error-hover cursor-pointer",
    info:
      "bg-background-info-default text-text-info-default hover:bg-background-info-hover cursor-pointer",
  };

  // ✏️ สีปุ่มแบบ Text (ไม่มีพื้นหลัง เน้นสีตัวอักษร)
  const textVariantClassMap: Record<IconButtonColor, string> = {
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

  const sizeClass =
    size === "large"
      ? "!w-12 !h-12"
      : size === "small"
        ? "!w-8 !h-8 text-sm"
        : "!w-10 !h-10"; // medium

  return (
    <button
      className={`${base} ${colorClass} ${sizeClass} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </button>
  );
};
