"use client";

import React, { useState } from "react";

export type TabsVariant = "underlined" | "filled";

export interface TabItem {
    label?: string;
    value: string;
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;
    disabled?: boolean;
}

export interface TabsProps {
    items: TabItem[];
    defaultValue?: string;
    onChange?: (value: string) => void;
    variant?: TabsVariant;
    size?: "small" | "medium";
    className?: string;
    gap?: string; // เช่น gap-2, gap-6
}

export const Tabs: React.FC<TabsProps> = ({
    items,
    defaultValue,
    onChange,
    variant = "underlined",
    size = "medium",
    className,
    gap = "gap-2 lg:gap-4",
}) => {
    const [active, setActive] = useState(defaultValue ?? items[0]?.value);

    const handleSelect = (value: string, disabled?: boolean) => {
        if (disabled) return;
        setActive(value);
        onChange?.(value);
    };

    const sizeClasses =
        size === "small"
            ? "px-2 py-1 h-8 text-sm"
            : "px-2 py-1 h-10 text-sm";

    return (
        <div className={`flex items-center ${gap} ${className ?? ""}`}>
            {items.map((item) => {
                const isActive = active === item.value;
                const isDisabled = item.disabled;

                /* ========== Variant Classes ========== */

                const underlined = `
          border-b-1 
          inline-flex items-center justify-center
          ${isActive
                        ? "border-border-primary-onlight text-text-primary-onlight"
                        : "text-text-default-default "}
        ${isDisabled
                        ? "border-border-primary-disable text-text-primary-disable cursor-not-allowed hover:text-text-primary-disable"
                        : "border-border-default-default hover:text-text-primary-onlight cursor-pointer "}`;

                const filled = `
          rounded-full inline-flex items-center justify-center
          ${isActive
                        ? "bg-background-primary-active text-text-primary-default"
                        : "hover:bg-background-default-hover"}
          ${isDisabled
                        ? "bg-background-primary-disable text-text-primary-disable cursor-not-allowed hover:text-text-primary-disable"
                        : "text-text-default-default cursor-pointer "}
        `;

                return (
                    <button
                        key={item.value}
                        onClick={() => handleSelect(item.value, item.disabled)}
                        disabled={isDisabled}
                        className={`
              ${sizeClasses}
              font-medium
              flex items-center gap-2
              ${variant === "underlined" ? underlined : filled}
            `}
                    >
                        {/* ⭐ StartIcon */}
                        {item.startIcon && (
                            <span className="flex items-center justify-center">
                                {item.startIcon}
                            </span>
                        )}

                        {/* Label */}
                        {item.label && <span>{item.label}</span>}

                        {/* ⭐ EndIcon */}
                        {item.endIcon && (
                            <span className="flex items-center justify-center">
                                {item.endIcon}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};
