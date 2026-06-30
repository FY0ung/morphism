"use client";

import React from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { Select } from "@/components/selection/Select"; // ✅ ใช้ Select ของคุณ
import { Button } from "@/components/actionable/Buttons"; // ถ้าจะใช้ปุ่มแบบ design system (ไม่จำเป็น)
import { motion } from "motion/react";

export interface PaginationProps {
    page: number;
    pageSize: number;
    total: number;

    pageSizeOptions?: number[];
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;

    className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
    page,
    pageSize,
    total,
    pageSizeOptions = [10, 20, 30, 40,50],
    onPageChange,
    onPageSizeChange,
    className,
}) => {
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const canPrev = page > 1;
    const canNext = page < totalPages;

    return (
        <div
            className={cn(
                "flex items-center gap-4 text-sm text-text-default-default",
                className
            )}
        >
            {/* Row per page */}
            <div className="flex items-center gap-2">
                <span className="whitespace-nowrap">Row per page</span>

                <Select.Root
                    value={String(pageSize)}
                    onValueChange={(v) => {
                        const next = Number(v);
                        if (!Number.isFinite(next)) return;
                        onPageSizeChange(next);
                        // แนะนำ: รีเซ็ตไปหน้า 1 ที่ parent เอง
                    }}
                >
                    <Select.Trigger>
                         {(open) => (
                            <Button
                                color="default"
                                variant="text"
                                size="small"
                                className="flex border border-border-default-default justify-center"
                            >
                                <span className="text-sm">{pageSize}</span>
                                <motion.span
                                    animate={{ rotate: open ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="flex items-center "
                                >
                                    <Icon name="ChevronDown" />
                                </motion.span>
                            </Button>
                        )}
                    </Select.Trigger>

                    <Select.Content>
                        {pageSizeOptions.map((opt) => (
                            <Select.Item
                                key={opt}
                                value={String(opt)}
                                item={String(opt)}
                            />
                        ))}
                    </Select.Content>
                </Select.Root>
            </div>

            {/* Range */}
            <div className="whitespace-nowrap">
                {start}–{end} of {total.toLocaleString()}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => canPrev && onPageChange(page - 1)}
                    className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-full",
                        canPrev
                            ? "hover:bg-background-default-hover"
                            : "opacity-40 cursor-not-allowed"
                    )}
                >
                    <Icon name="ChevronLeft" />
                </button>

                <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => canNext && onPageChange(page + 1)}
                    className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-full",
                        canNext
                            ? "hover:bg-background-default-hover"
                            : "opacity-40 cursor-not-allowed"
                    )}
                >
                    <Icon name="ChevronRight" />
                </button>
            </div>
        </div>
    );
};
