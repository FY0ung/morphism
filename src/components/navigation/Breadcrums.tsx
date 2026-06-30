"use client";

import React from "react";
import Link from "next/link";
import { Tag } from "../selection/Tag";

export interface BreadcrumbItem {
    label: string;
    href?: string;           // ถ้าไม่มี href = เป็น active item
    icon?: React.ReactNode;  // ⭐ เพิ่ม icon ต่อ breadcrumb ได้
}

export interface BreadcrumbsProps
    extends React.HTMLAttributes<HTMLElement> {
    items: BreadcrumbItem[];
    separator?: React.ReactNode;  // custom separator (default = "/")
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
    items,
    separator = "/",
    className,
    ...rest
}) => {
    return (
        <nav
            aria-label="breadcrumbs"
            className={`flex items-center gap-2 text-sm ${className ?? ""}`}
            {...rest}
        >
            <ol role="list" className="flex flex-wrap items-center gap-2">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;

                    return (
                        <li
                            role="listitem"
                            key={`${item.label}-${item.href ?? "current"}`}
                            className="flex items-center gap-2"
                        >
                            {/* Link / Active Item */}
                            {item.href && !isLast ? (
                                <Link href={item.href}>
                                    <Tag
                                        color="default"
                                        size="extra-small"
                                        className="bg-transparent text-text-default-onlight"
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            {item.icon && (
                                                <span className="shrink-0">
                                                    {item.icon}
                                                </span>
                                            )}
                                            <span>{item.label}</span>
                                        </span>
                                    </Tag>
                                </Link>
                            ) : (
                                <Tag
                                    color="default"
                                    size="extra-small"
                                    className="bg-transparent text-text-default-default font-medium"
                                >
                                    <span className="inline-flex items-center gap-2">
                                        {item.icon && (
                                            <span className="shrink-0">
                                                {item.icon}
                                            </span>
                                        )}
                                        <span>{item.label}</span>
                                    </span>
                                </Tag>
                            )}

                            {/* Separator */}
                            {!isLast && (
                                <span className="flex items-center text-text-default-default select-none">
                                    {separator}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};
