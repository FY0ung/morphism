"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Tag, TagColor, TagVariant } from "../selection/Tag";

/* -------------------------------------------------- */
/* Types                                              */
/* -------------------------------------------------- */
export type MenuOrientation = "vertical" | "horizontal";
export type MenuItemState = "default" | "disabled";

/**
 * ✅ ใช้ Tag เป็น Badge
 * - lock size = "extra-small"
 * - color/variant เลือกเองได้ตอนเรียกใช้
 */
export type MenuBadge = {
    label: string;
    color?: TagColor;
    variant?: TagVariant;
    className?: string;
};

/* -------------------------------------------------- */
/* Root                                               */
/* -------------------------------------------------- */
export interface MenuProps {
    children: React.ReactNode;
    orientation?: MenuOrientation;
    className?: string;
}

const MenuRoot: React.FC<MenuProps> = ({
    children,
    orientation = "vertical",
    className,
}) => {
    return (
        <div
            className={cn(
                "bg-background-default-default rounded-3xl p-2",
                orientation === "horizontal"
                    ? "grid grid-cols-2 gap-6"
                    : "flex flex-col gap-2",
                className
            )}
        >
            {children}
        </div>
    );
};

/* -------------------------------------------------- */
/* Section                                            */
/* -------------------------------------------------- */
export interface MenuSectionProps {
    title?: string;
    children: React.ReactNode;
    className?: string;
}

const MenuSection: React.FC<MenuSectionProps> = ({
    title,
    children,
    className,
}) => {
    return (
        <div className={cn("flex flex-col gap-1", className)}>
            {title && (
                <div className="px-2 pt-2 pb-1 text-sm text-text-default-default">
                    {title}
                </div>
            )}
            {children}
        </div>
    );
};

/* -------------------------------------------------- */
/* Item                                               */
/* -------------------------------------------------- */
export interface MenuItemProps {
    icon?: React.ReactNode;
    label: string;
    description?: string;

    badge?: MenuBadge;

    state?: MenuItemState;
    onClick?: () => void;

    className?: string;
}

const MenuItem: React.FC<MenuItemProps> = ({
    icon,
    label,
    description,
    badge,
    state = "default",
    onClick,
    className,
}) => {
    const disabled = state === "disabled";

    return (
        <div
            onClick={() => {
                if (!disabled) onClick?.();
            }}
            className={cn(
                `
        flex items-center justify-start gap-4
        px-2 rounded-3xl
        transition-colors
        `,
                disabled
                    ? "cursor-not-allowed text-text-default-disable"
                    : "cursor-pointer hover:bg-background-default-hover",
                className
            )}
        >
            {/* Icon */}
            {icon && (
                <div className="flex shrink-0 w-10 h-10  items-center justify-center rounded-lg bg-background-default-light">
                    {icon}
                </div>
            )}

            {/* Text */}
            <div className="flex flex-col w-full py-2 gap-1 ">
                <div className={cn(
                    `text-sm `,
                    disabled
                        ? "cursor-not-allowed text-text-default-disable"
                        : "text-text-default-default",
                )}>
                    {label}
                </div>
                {description && (
                    <div className={cn(
                        `text-sm`,
                        disabled
                            ? "cursor-not-allowed text-text-default-disable"
                            : "text-text-default-onlight ",
                    )}>
                        {description}
                    </div>
                )}
            </div>

            {/* Badge (Tag) */}
            {badge && (
                <Tag
                    size="extra-small" // ✅ lock
                    color={badge.color ?? "default"}
                    variant={badge.variant ?? "filled"}
                    className={cn("ml-12 shrink-0", badge.className)}
                >
                    {badge.label}
                </Tag>
            )}
        </div>
    );
};

/* -------------------------------------------------- */
/* Export                                             */
/* -------------------------------------------------- */
export const Menu = {
    Root: MenuRoot,
    Section: MenuSection,
    Item: MenuItem,
};
