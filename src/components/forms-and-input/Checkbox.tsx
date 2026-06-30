"use client";

import React from "react";
import { Icon } from "../icons";

export type CheckboxState = "checked" | "unchecked" | "indeterminate";
export type CheckboxStatus = "default" | "disabled";

export interface CheckboxProps {
  value: CheckboxState;
  onChange?: (val: CheckboxState) => void;
  state?: CheckboxStatus;
  label?: string;
  description?: string;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  value,
  onChange,
  state = "default",
  label,
  description,
  className,
}) => {
  const disabled = state === "disabled";

  const toggle = () => {
    if (disabled) return;

    if (value === "unchecked") onChange?.("checked");
    else if (value === "checked") onChange?.("unchecked");
    else onChange?.("checked");
  };

  const boxBase =
    "flex items-center justify-center w-4 h-4 rounded-sm transition-all";

  const boxStyle = (() => {
    if (disabled) {
      if (value === "checked" || value === "indeterminate") {
        return "bg-background-default-light text-text-default-light";
      }
      return "border border-border-default-ondisabled bg-background-default-default";
    }

    if (value === "checked" || value === "indeterminate") {
      return "bg-background-primary-default text-text-primary-default";
    }

    return "border border-background-primary-default bg-background-default-default";
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
      <div className={`${boxBase} ${boxStyle}`}>
        {value === "checked" && <Icon name="Check"/>}
        {value === "indeterminate" && (<Icon name="Minus"/>)}
      </div>

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
