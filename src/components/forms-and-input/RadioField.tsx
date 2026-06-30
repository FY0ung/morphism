"use client";

import React from "react";

export type RadioState = "checked" | "unchecked";
export type RadioStatus = "default" | "disabled";

export interface RadioFieldProps {
  value: RadioState;
  onChange?: (val: RadioState) => void;
  status?: RadioStatus;
  label?: string;
  description?: string;
  className?: string;
}

export const RadioField: React.FC<RadioFieldProps> = ({
  value,
  onChange,
  status = "default",
  label,
  description,
  className,
}) => {
  const disabled = status === "disabled";

  const toggle = () => {
    if (disabled) return;
    if (value === "unchecked") onChange?.("checked");
    else onChange?.("unchecked");
  };

  // 🔹 กล่อง radio (วงกลม)
  const outerBase =
    "flex items-center justify-center w-4 h-4 rounded-full border transition-all";

  const outerClass = (() => {
    if (disabled) {
      if (value === "checked") {
        return "border-border-default-disable bg-background-default-default";
      }
      return "border-border-default-disable bg-background-default-default";
    }

    if (value === "checked") {
      return "border-0 bg-background-primary-default";
    }

    // default + unchecked
    return "border-border-primary-default bg-background-default-default";
  })();

  const innerClass = (() => {
    if (disabled && value === "checked") {
      return "w-1.5 h-1.5 rounded-full bg-background-default-disabled";
    }
    if (!disabled && value === "checked") {
      return "w-1.5 h-1.5 rounded-full bg-background-default-default";
    }
    return "";
  })();

  const textColor = disabled
    ? "text-text-default-disable"
    : "text-text-default-default";

  const descriptionColor = disabled
    ? "text-text-default-disable"
    : "text-text-default-onlight";

  return (
    <div
      className={`flex items-start gap-3 select-none ${
        disabled ? "cursor-not-allowed" : "cursor-pointer"
      } ${className ?? ""}`}
      onClick={toggle}
    >
      {/* วงกลม radio */}
      <div className={`${outerBase} ${outerClass}`}>
        {value === "checked" && <div className={innerClass} />}
      </div>

      {/* Label / Description */}
      {(label || description) && (
        <div className="flex flex-col text-sm leading-tight gap-2">
          {label && (
            <span className={`${textColor}`}>{label}</span>
          )}
          {description && (
            <span className={`${descriptionColor}`}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
