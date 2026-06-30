"use client";

import React from "react";
import { Icon } from "@/components/icons";
import { IconButton, IconButtonColor } from "@/components/actionable/IconButtons";
import { motion, AnimatePresence } from "motion/react";

export type BannerColor =
    | "default"
    | "primary"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "secondary";

export type BannerPosition =
    | "inline"        // ใช้ใน layout ตามปกติ (ไม่ fixed)
    | "top"           // กลางบนจอ
    | "top-left"
    | "top-right"
    | "bottom"        // กลางล่างจอ
    | "bottom-left"
    | "bottom-right";

export interface BannerProps {
    open: boolean;
    onClose?: () => void;

    color?: BannerColor;
    title?: string;
    children?: React.ReactNode;
    icon?: React.ReactNode;
    imageSrc?: string;
    footer?: React.ReactNode;

    position?: BannerPosition;
    className?: string;
}

/* ---------------------------------------------------------
   COLOR MAP (ใช้ Background + Text + Shadow)
--------------------------------------------------------- */

const colorStyleMap: Record<BannerColor, string> = {
    default:
        "bg-background-default-default text-text-default-onlight dropshadow-200",
    primary:
        "bg-background-primary-light text-text-primary-onlight dropshadow-200",
    secondary:
        "bg-background-secondary-light text-text-secondary-onlight dropshadow-200",
    success:
        "bg-background-success-light text-text-success-onlight dropshadow-200",
    warning:
        "bg-background-warning-light text-text-warning-onlight dropshadow-200",
    danger:
        "bg-background-error-light text-text-error-onlight dropshadow-200",
    info:
        "bg-background-info-light text-text-info-onlight dropshadow-200",

};

const closeIconButtonColorMap: Record<BannerColor, IconButtonColor> = {
    default: "default",
    primary: "primary",
    success: "success",
    warning: "warning",
    danger: "danger",
    info: "info",
    secondary: "secondary",
} as const;


/* ---------------------------------------------------------
   POSITION MAP (fixed + p-6)
--------------------------------------------------------- */

function getPositionClass(position: BannerPosition): string {
    switch (position) {
        case "top":
            return "fixed top-24 left-6 right-6 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:w-auto z-50";
        case "top-left":
return "fixed top-24 left-6 right-6 lg:right-auto z-50";
        case "top-right":
            return "fixed top-24 left-6 right-6 lg:left-auto z-50";
        case "bottom":
            return "fixed bottom-6 left-6 right-6 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:w-auto z-50";
        case "bottom-left":
            return "fixed bottom-6 left-6 right-6 lg:right-auto lg:left-6 z-50";
        case "bottom-right":
            return "fixed bottom-6 left-6 right-6 lg:left-auto lg:right-6 z-50";
        case "inline":
        default:
            return "w-full";
    }
}

/* ---------------------------------------------------------
   BANNER COMPONENT
--------------------------------------------------------- */

export const Banner: React.FC<BannerProps> = ({
    open,
    onClose,
    color = "default",
    title,
    children,
    icon,
    imageSrc,
    footer,
    position = "inline",
    className,
}) => {
    const colorClasses = colorStyleMap[color];
    const positionClasses = getPositionClass(position);

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: position.startsWith("bottom") ? 20 : -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: position.startsWith("bottom") ? 15 : -15 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={`
            flex flex-col rounded-3xl p-4 gap-3
            ${colorClasses}
            ${positionClasses}
            ${className ?? ""}
          `}
                >
                    {/* Content layout */}
                    <div className="flex w-full items-start gap-4">
                        {(imageSrc || icon) && (
                            <span className="flexitems-center justify-center text-xl shrink-0">
                                {imageSrc ? (
                                    <img
                                        src={imageSrc}
                                        alt=""
                                        className="w-12 h-12 rounded-full object-cover"
                                    />
                                ) : (
                                    icon
                                )}
                            </span>
                        )}

                        {/* Title + description + footer */}
                        <div className="flex w-full justify-between items-center gap-3">
                            <div className="flex flex-col gap-2 min-w-0">
                                {title && (
                                    <h2 className="text-sm truncate">
                                        {title}
                                    </h2>
                                )}

                                {children && (
                                    <div className="text-sm leading-relaxed wrap-break-word max-w-2xl">
                                        {children}
                                    </div>
                                )}
                            </div>

                            {/* Footer (actions) */}
                            <div className="hidden sm:block">
                                {footer && (
                                    <div className="flex justify-end items-center gap-2">
                                        {footer}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Close button */}
                        {onClose && (
                            <div className="shrink-0">
                                <IconButton
                                    variant="text"
                                    color={closeIconButtonColorMap[color]}
                                    size="small"
                                    onClick={onClose}
                                >
                                    <Icon name="XClose" />
                                </IconButton>
                            </div>
                        )}
                    </div>
                    <div className="sm:hidden">
                        {footer && (
                            <div className="flex justify-center items-center gap-2">
                                {footer}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
