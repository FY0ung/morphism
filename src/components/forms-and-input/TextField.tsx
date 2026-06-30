"use client";

import React, { forwardRef } from "react";

/* -------------------------------------------------- */
/* Types                                              */
/* -------------------------------------------------- */
export type TextFieldVariant = "filled" | "outline";
export type TextFieldSize = "medium" | "small";
export type TextFieldState =
  | "default"
  | "hover"
  | "active"
  | "disabled"
  | "error";

export interface TextFieldProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size" | "children" | "onClick"
  > {
  variant?: TextFieldVariant;
  size?: TextFieldSize;
  state?: TextFieldState;
  label?: string;

  iconStart?: React.ReactNode;
  iconEnd?: React.ReactNode;

  /** ⭐ ให้ wrapper รับคลิกได้ (ใช้เป็น Select.Trigger) */
  onClick?: React.MouseEventHandler<HTMLDivElement>;

  /** ⭐ ใช้แทน input value (เช่น multi select chips) */
  renderValue?: React.ReactNode;

  /** ⭐ เผื่ออยากใช้ slot แบบอิสระ */
  children?: React.ReactNode;

  className?: string;
}

/* -------------------------------------------------- */
/* Component                                          */
/* -------------------------------------------------- */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      variant = "outline",
      size = "medium",
      state = "default",
      label,
      iconStart,
      iconEnd,

      renderValue,
      children,

      onClick,

      value,
      onChange,
      readOnly,
      disabled: disabledProp,
      className,
      ...rest
    },
    ref
  ) => {
    const isDisabled = state === "disabled" || disabledProp;

    const sizeClass: Record<TextFieldSize, string> = {
      medium: "h-10 text-sm px-4 gap-2",
      small: "h-8 text-sm px-3 gap-2",
    };

    const variantClass = (() => {
      if (variant === "outline") {
        if (isDisabled)
          return "bg-background-default-disable border-border-default-ondisabled";
        if (state === "error") return "border-border-error-default";
        if (state === "active")
          return "border-border-primary-default ring-1 ring-border-primary-default";
        return "border-border-default-default hover:border-border-default-onlight";
      }

      // filled
      if (isDisabled) return "bg-background-default-disable border-transparent";
      if (state === "error")
        return "bg-background-error-light border-border-error-default";
      if (state === "active")
        return "bg-background-default-default border-background-primary-default ring-1 ring-background-primary-default";
      return "bg-background-default-light border-transparent hover:bg-background-default-light_hover";
    })();

    const labelColor =
      isDisabled ? "text-text-default-light" : "text-text-default-default";

    const showValueSlot = Boolean(renderValue) || Boolean(children);

    return (
      <div className={`flex flex-col gap-1 ${className ?? ""}`}>
        {label && (
          <label className={`text-xs font-medium ${labelColor}`}>
            {label}
          </label>
        )}

        <div
          onClick={isDisabled ? undefined : onClick}
          className={`
            flex items-center rounded-full border transition-all
            ${sizeClass[size]}
            ${variantClass}
            ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}
            min-w-0
          `}
        >
          {iconStart && (
            <span className="shrink-0 text-text-default-default">
              {iconStart}
            </span>
          )}

          {/* VALUE SLOT (scrollable) */}
          {showValueSlot ? (
            <div
              className={`
                flex-1 min-w-0
                overflow-x-auto overflow-y-hidden
                whitespace-nowrap
              `}
            >
              {/* ตัวห่อด้านในให้เป็น inline-flex จะกันตกบรรทัด + ให้ความกว้างยืดตาม content */}
              <div className="inline-flex items-center gap-1">
                {children ?? renderValue}
              </div>
            </div>
          ) : (
            <input
              ref={ref}
              {...rest}
              value={value}
              onChange={onChange}
              readOnly={readOnly}
              disabled={isDisabled}
              className="
                flex-1 min-w-0 bg-transparent outline-none border-none
                text-inherit placeholder:text-text-default-onlight
                disabled:cursor-not-allowed
              "
            />
          )}

          {iconEnd && (
            <span className="shrink-0 text-text-default-default">
              {iconEnd}
            </span>
          )}
        </div>
      </div>
    );
  }
);

TextField.displayName = "TextField";
