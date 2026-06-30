"use client";

import React from "react";
import {
  TextField,
  type TextFieldVariant,
  type TextFieldSize,
  type TextFieldState,
} from "@/components/forms-and-input/TextField";
import { Icon } from "@/components/icons";

export interface SearchFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size" | "value" | "onChange"
  > {
  variant?: TextFieldVariant;
  size?: TextFieldSize;
  state?: TextFieldState;
  label?: string;

  /** controlled value จากข้างนอกเท่านั้น */
  value: string;
  onChange: (value: string) => void;

  className?: string;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  variant = "outline",
  size = "small",
  state = "default",
  label,
  value,
  onChange,
  className,
  ...rest
}) => {
  const disabled = state === "disabled";

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    if (disabled) return;
    onChange("");
  };

  const showClear = !disabled && value.length > 0;

  return (
    <TextField
      className={className}
      variant={variant}
      size={size}
      state={state}
      label={label}
      value={value}
      onChange={handleChange}
      iconStart={<Icon name="SearchMd" />}
      iconEnd={
        <div className="relative w-5 h-5 flex items-center justify-center">
          <button
            type="button"
            onClick={handleClear}
            className={`
              absolute inset-0 flex items-center justify-center
              transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]
              ${
                showClear
                  ? "opacity-100 scale-100 translate-y-0"
                  : "opacity-0 scale-75 translate-y-1 pointer-events-none"
              }
            `}
          >
            <Icon name="XClose" />
          </button>
        </div>
      }
      {...rest}
    />
  );
};
