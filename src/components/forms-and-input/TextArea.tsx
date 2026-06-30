"use client";

import React from "react";

export type TextAreaVariant = "filled" | "outline";
export type TextAreaState =
  | "default"
  | "hover"
  | "active"
  | "disabled"
  | "error";

export interface TextAreaProps
  extends Omit<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    "size" | "onChange"
  > {
  variant?: TextAreaVariant;
  state?: TextAreaState;
  label?: string;
  description?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  variant = "outline",
  state = "default",
  label,
  description,
  value,
  onChange,
  className,
  ...rest
}) => {
  const disabled = state === "disabled";

  /** Handle state change */
  const handleChange: React.ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    onChange?.(e.target.value);
  };

  /** Container + variant + state styles (เหมือน TextField) */
  const containerBase =
    "flex flex-col gap-2 w-full transition-all duration-150";

  const fieldBase =
    "relative rounded-2xl border w-full transition-all duration-150 focus-within:border-border-primary-default focus-within:ring-1 focus-within:ring-border-primary-default flex";

  const fieldVariantClass = (() => {
    const isError = state === "error";

    if (variant === "outline") {
      if (disabled)
        return "bg-background-default-disable border-border-default-ondisabled text-text-default-light cursor-not-allowed";

      if (isError)
        return "bg-background-error-light border-border-error-default text-text-error-default";

      if (state === "hover")
        return "bg-background-default-light_hover border-border-default-onlight";

      if (state === "active")
        return "bg-background-default-default border-background-primary-default ring-1 ring-background-primary-default";

      return "bg-transparent border-border-default-onlight hover:bg-background-default-light_hover";
    }

    // filled
    if (disabled)
      return "bg-background-default-disable border-transparent text-text-default-light cursor-not-allowed";

    if (isError)
      return "bg-background-error-light border-border-error-default text-text-error-default";

    return "bg-background-default-light border-transparent hover:bg-background-default-light_hover";
    
  })();

  const labelColor =
    state === "disabled"
      ? "text-text-default-light"
      : state === "error"
      ? "text-text-error-default"
      : "text-text-default-default";

  const descColor =
    state === "disabled"
      ? "text-text-default-light"
      : state === "error"
      ? "text-text-error-default"
      : "text-text-default-onlight";

  const textColor = disabled
    ? "text-text-default-light"
    : "text-text-default-default";

  return (
    <div className={`${containerBase} ${className ?? ""}`}>
      {/* Label */}
      {label && (
        <label className={`text-sm ${labelColor}`}>
          {label}
        </label>
      )}

      {/* TextArea Container */}
      <div className={`${fieldBase} ${fieldVariantClass}`}>
        <textarea
          {...rest}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          className={`
            w-full outline-none resize-none leading-5
            text-sm px-4 py-3
            ${textColor}
          `}
        />
      </div>

      {/* Description */}
      {description && (
        <span className={`text-sm ${descColor}`}>{description}</span>
      )}
    </div>
  );
};
