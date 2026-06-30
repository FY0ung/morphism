"use client";

import React from "react";

export type SwitchValue = "checked" | "unchecked";
export type SwitchStatus = "default" | "disabled";
export type SwitchSize = "medium" | "small";

export interface SwitchProps {
  value: SwitchValue;
  onChange?: (val: SwitchValue) => void;
  status?: SwitchStatus;
  size?: SwitchSize;
  label?: string;
  description?: string;
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  value,
  onChange,
  status = "default",
  size = "medium",
  label,
  description,
  className,
}) => {
  const disabled = status === "disabled";

  const toggle = () => {
    if (disabled) return;
    onChange?.(value === "checked" ? "unchecked" : "checked");
  };

  // ----- Track & Thumb size mapping -----
  const trackSizeMap: Record<SwitchSize, string> = {
    medium: "w-10 h-[22px]", // 40 x 22
    small: "w-7 h-4",        // ~28 x 16
  };

  const thumbSizeMap: Record<SwitchSize, string> = {
    medium: "w-4 h-4",
    small: "w-3 h-3",
  };

  const thumbTranslateChecked =
    size === "medium" ? "translate-x-5" : "translate-x-3.5";
  const thumbTranslateUnchecked = "translate-x-1";

  // ----- Track style -----
  const trackBase =
    "rounded-full flex items-center transition-all duration-200";

  // 🎨 คำนวณสี bg ตามสเปกที่ให้มา
  const trackColor = (() => {
    if (value === "checked") {
      // Type = Checked
      if (disabled) {
        // State = Disabled
        return "bg-background-primary-light_active cursor-not-allowed";
      }
      // State = Default
      return "bg-background-primary-default cursor-pointer";
    }

    // Type = Unchecked
    if (disabled) {
      // State = Disabled
      return "bg-background-default-light_active cursor-not-allowed";
    }
    // State = Default
    return "bg-background-default-light_active cursor-pointer";
  })();

  // ----- Thumb style -----
  const thumbBase =
    "rounded-full bg-background-default-default shadow transition-all duration-200";

  const thumbPos =
    value === "checked"
      ? thumbTranslateChecked
      : thumbTranslateUnchecked;

  const thumbDisabled = disabled ? "bg-background-default-disable" : "";

  // ----- Text color -----
  const labelColor = disabled
    ? "text-text-default-light"
    : "text-text-default-default";

  const descColor = disabled
    ? "text-text-default-light"
    : "text-text-default-light";

  return (
    <div
      className={`flex items-start gap-3 select-none ${
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      } ${className ?? ""}`}
      onClick={toggle}
    >
      {/* Switch */}
      <div className={`${trackBase} ${trackSizeMap[size]} ${trackColor}`}>
        <div
          className={`${thumbBase} ${thumbSizeMap[size]} ${thumbPos} ${thumbDisabled}`}
        />
      </div>

      {/* Label + Description (optional) */}
      {(label || description) && (
        <div className="flex flex-col leading-tight">
          {label && (
            <span className={`text-sm font-medium ${labelColor}`}>
              {label}
            </span>
          )}
          {description && (
            <span className={`text-xs mt-0.5 ${descColor}`}>
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
