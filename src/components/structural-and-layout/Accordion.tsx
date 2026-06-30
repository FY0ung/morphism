"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icons";

export type AccordionVariant = "default" | "outline";

export interface AccordionItemProps {
    title: string;
    content: React.ReactNode;
    disabled?: boolean;
}

export interface AccordionProps {
    items: AccordionItemProps[];
    variant?: AccordionVariant;
    defaultOpenIndex?: number | null;
}

export const Accordion: React.FC<AccordionProps> = ({
    items,
    variant = "default",
    defaultOpenIndex = null,
}) => {
    const [openIndex, setOpenIndex] = useState<number | null>(
        defaultOpenIndex
    );

    const toggle = (index: number, disabled?: boolean) => {
        if (disabled) return;
        setOpenIndex(openIndex === index ? null : index);
    };

    return (
        <div className={cn(
            "flex flex-col w-full",
            variant === "default" && "gap-2",
            variant === "outline" && ""
        )}>
            {items.map((item, index) => {
                const isOpen = openIndex === index;

                return (
                    <motion.div
                        key={index}
                        className={cn(
                            "text-text-default-default p-4 transition-all",
                            variant === "default" && "bg-background-default-default dropshadow-200 rounded-2xl",
                            variant === "outline" &&
                            "border-t border-border-default-default",
                            item.disabled && "bg-background-default-disable text-text-default-disable cursor-not-allowed"
                        )}
                        initial={false}
                        animate={{
                            backgroundColor: isOpen && variant === "default"
                                ? ""
                                : "",
                        }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Header */}
                        <button
                            className="flex w-full justify-between items-center"
                            onClick={() => toggle(index, item.disabled)}
                            disabled={item.disabled}
                        >
                            <span className="text-sm font-semibold ">
                                {item.title}
                            </span>

                            <motion.div
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                            >
                                <Icon name="ChevronDown" />
                            </motion.div>
                        </button>

                        {/* Content */}
                        <AnimatePresence initial={false}>
                            {isOpen && !item.disabled && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{
                                        height: "auto",
                                        opacity: 1,
                                    }}
                                    exit={{
                                        height: 0,
                                        opacity: 0,
                                    }}
                                    transition={{
                                        height: {
                                            duration: 0.3,
                                            ease: [0.4, 0, 0.2, 1],
                                        },
                                        opacity: {
                                            duration: 0.25,
                                            ease: "easeInOut",
                                        },
                                    }}
                                    className="overflow-hidden"
                                >
                                    <motion.div
                                        initial={{ y: -10 }}
                                        animate={{ y: 0 }}
                                        exit={{ y: -10 }}
                                        transition={{ duration: 0.25, ease: "easeOut" }}
                                        className="mt-4"
                                    >
                                        <span className="text-sm">
                                            {item.content}
                                        </span>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                );
            })}
        </div>
    );
}