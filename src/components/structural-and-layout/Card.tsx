"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type CardType = "icon" | "image" | "custom";
export type CardDirection = "horizontal" | "vertical";

export interface CardProps {
    type?: CardType;
    direction?: CardDirection;

    title?: string;
    description?: string;

    icon?: React.ReactNode;
    imageSrc?: string;
    imageAlt?: string;

    actions?: React.ReactNode;

    /** ⭐ สำหรับ custom content */
    children?: React.ReactNode;

    className?: string;
}

export const Card: React.FC<CardProps> = ({
    type = "icon",
    direction = "horizontal",
    title,
    description,
    icon,
    imageSrc,
    imageAlt = "",
    actions,
    children,
    className,
}) => {
    const isImageCard = type === "image";
    const isIconCard = type === "icon";
    const isCustom = type === "custom";

    const isHorizontal = direction === "horizontal";

    return (
        <div
            className={cn(
                "flex w-full bg-background-default-default rounded-3xl dropshadow-200",
                isHorizontal ? "flex-row" : "flex-col",
                "p-4 gap-4",
                className
            )}
        >
            {/* MEDIA (icon / image) */}
            {!isCustom && (
                <>
                    {isImageCard && imageSrc && (
                        <div
                            className={cn(
                                "flex bg-background-default-light rounded-lg overflow-hidden items-center justify-center",
                                isHorizontal
                                    ? "max-w-40 max-h-40"
                                    : "w-full max-h-40"
                            )}
                        >
                            <img
                                src={imageSrc}
                                alt={imageAlt}
                                className="object-contain w-full max-h-full"
                            />
                        </div>
                    )}

                    {isIconCard && icon && (
                        <div className="flex justify-start">{icon}</div>
                    )}
                </>
            )}

            {/* CONTENT SECTION */}
            <div
                className={cn(
                    "flex w-full flex-col gap-4",
                    isHorizontal ? "justify-between" : ""
                )}
            >
                {/* ⭐ CUSTOM MODE → render children ทั้งก้อน */}
                {isCustom ? (
                    <div className="w-full">{children}</div>
                ) : (
                    <>
                        {/* Default title + description */}
                        <div className="flex flex-col gap-4">
                            {title && (
                                <h3 className="text-sm font-semibold text-text-default-default">
                                    {title}
                                </h3>
                            )}
                            {description && (
                                <p className="text-sm text-text-default-onlight">
                                    {description}
                                </p>
                            )}
                        </div>

                        {/* Actions */}
                        {actions && (
                            <div className="flex w-full gap-2">{actions}</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
