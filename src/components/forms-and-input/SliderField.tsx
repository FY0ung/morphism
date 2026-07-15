"use client";

import React, { useRef, useState } from "react";
import { Button } from "../actionable/Buttons";

export type SliderType = "continue" | "range";
export type SliderStatus = "default" | "disabled";

export interface SliderFieldProps {
    type?: SliderType;
    status?: SliderStatus;

    /** defaultValue:
     *  Continue  → [50]
     *  Range     → [25, 75]
     */
    defaultValue?: number[];

    min?: number;
    max?: number;
    step?: number;

    label?: string;             // ถ้าไม่ส่ง จะไม่แสดง
    prefix?: string;            // เช่น "$"
    suffix?: string;            // เช่น "%"

    description?: string;       // ถ้าไม่ส่ง จะไม่แสดง

    /** Input buttons */
    startInput?: boolean;       // range only
    endInput?: boolean;         // range only

    /** Icons */
    startIcon?: React.ReactNode;
    endIcon?: React.ReactNode;

    className?: string;
}

export const SliderField: React.FC<SliderFieldProps> = ({
    type = "continue",
    status = "default",

    defaultValue = type === "continue" ? [50] : [25, 75],

    min = 0,
    max = 100,
    step = 1,

    label,
    prefix = "",
    suffix = "",

    description,

    startInput = true,
    endInput = true,

    startIcon,
    endIcon,

    className,
}) => {
    const disabled = status === "disabled";
    const trackRef = useRef<HTMLDivElement | null>(null);

    // --------------------------------------------
    //  Internal States (No need for external state)
    // --------------------------------------------
    const [single, setSingle] = useState(defaultValue[0]);
    const [range, setRange] = useState<[number, number]>(
        type === "range"
            ? (defaultValue as [number, number])
            : [defaultValue[0], defaultValue[0]]
    );

    // Convert number → %
    const percent = (v: number) => ((v - min) / (max - min)) * 100;

    const p1 =
        type === "continue" ? percent(single) : percent(range[0]);
    const p2 =
        type === "continue" ? percent(single) : percent(range[1]);

    // ----------------------------
    // Single Update
    // ----------------------------
    const updateSingle = (clientX: number) => {
        if (!trackRef.current || disabled) return;

        const rect = trackRef.current.getBoundingClientRect();
        const pos = Math.min(Math.max(clientX - rect.left, 0), rect.width);
        const rawValue = min + (pos / rect.width) * (max - min);

        const stepped = Math.round(rawValue / step) * step;

        setSingle(Math.min(max, Math.max(min, stepped)));
    };

    // ----------------------------
    // Range Update
    // ----------------------------
    const updateRange = (clientX: number, index: 0 | 1) => {
        if (!trackRef.current || disabled) return;

        const rect = trackRef.current.getBoundingClientRect();
        const pos = Math.min(Math.max(clientX - rect.left, 0), rect.width);
        const rawValue = min + (pos / rect.width) * (max - min);
        const stepped = Math.round(rawValue / step) * step;

        const newRange = [...range] as [number, number];
        newRange[index] = Math.min(max, Math.max(min, stepped));

        // Prevent crossover
        if (newRange[0] > newRange[1]) {
            if (index === 0) newRange[0] = newRange[1];
            else newRange[1] = newRange[0];
        }

        setRange(newRange);
    };

    // ----------------------------
    // Drag
    // ----------------------------
    // Invoked from the event (never during render — the old curried form
    // `startDrag(fn)` ran at render time while `fn` closes over a ref, which
    // React Compiler rejects).
    const beginDrag = (
        e: React.MouseEvent,
        handler: (clientX: number) => void,
    ) => {
        handler(e.clientX);

        const move = (ev: MouseEvent) => handler(ev.clientX);
        const up = () => {
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", up);
        };

        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
    };

    // ----------------------------
    // Colors
    // ----------------------------
    const trackBg = "bg-background-default-light";
    const activeBg = disabled
        ? "bg-background-primary-light_active"
        : "bg-background-primary-default";

    const thumbColor = disabled
        ? "bg-background-default-disable"
        : "bg-background-default-default";

    const labelColor = disabled
        ? "text-text-default-light"
        : "text-text-default-default";

    const textLight = disabled
        ? "text-text-default-light"
        : "text-text-default-light";

    const displayValue =
        type === "continue"
            ? `${prefix}${single}${suffix}`
            : `${prefix}${range[0]} - ${range[1]}${suffix}`;

    return (
        <div className={`flex flex-col gap-3 ${className}`}>
            {/* LABEL + VALUE */}
            {label && (
                <div className="flex w-full justify-between items-center">
                    <span className={`text-sm ${labelColor}`}>
                        {label}
                    </span>

                    <span className={`text-sm ${labelColor}`}>
                        {displayValue}
                    </span>
                </div>
            )}

            {/* SLIDER + ICONS */}
            <div className="flex items-center gap-4">
                {startIcon && (
                    <span className="flex items-center">{startIcon}</span>
                )}

                {/* Track */}
                <div className="relative flex-1">
                    <div
                        ref={trackRef}
                        className={`relative w-full h-1.5 rounded-full ${trackBg}`}
                    >
                        {/* Active highlight */}
                        <div
                            className={`absolute top-0 h-full rounded-full ${activeBg}`}
                            style={{
                                left: `${type === "continue" ? 0 : p1}%`,
                                width: `${type === "continue" ? p1 : p2 - p1}%`,
                            }}
                        />

                        {/* Left Thumb (range only) */}
                        {type === "range" && (
                            <div
                                className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-background-default-default border border-border-primary-default rounded-full shadow cursor-pointer ${thumbColor}`}
                                style={{ left: `calc(${p1}% - 8px)` }}
                                onMouseDown={(e) =>
                                    beginDrag(e, (x) => updateRange(x, 0))
                                }
                            />
                        )}

                        {/* Right Thumb */}
                        <div
                            className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-background-default-default border border-border-primary-default rounded-full shadow cursor-pointer ${thumbColor}`}
                            style={{
                                left: `calc(${type === "continue" ? p1 : p2}% - 8px)`,
                            }}
                            onMouseDown={(e) =>
                                beginDrag(e, (x) =>
                                    type === "continue"
                                        ? updateSingle(x)
                                        : updateRange(x, 1),
                                )
                            }
                        />
                    </div>
                </div>

                {endIcon && (
                    <span className="flex items-center">{endIcon}</span>
                )}
            </div>

            {/* INPUT BUTTONS */}
            {type === "continue" && (
                <div className="flex w-full justify-end">
                    <Button color="default" variant="text" size="small" className="border border-border-default-onlight w-16" >
                        {single}
                    </Button>
                </div>
            )}

            {type === "range" && (
                <div className="flex w-full justify-between">
                    {startInput ? (
                        <Button color="default" variant="text" size="small" className="border border-border-default-onlight w-16" >
                            {range[0]}
                        </Button>
                    ) : (
                        <div />
                    )}

                    {endInput && (
                        <Button color="default" variant="text" size="small" className="border border-border-default-onlight w-16" >
                            {range[1]}
                        </Button>
                    )}
                </div>
            )}

            {/* DESCRIPTION */}
            {description && (
                <span className={`text-sm text-text-default-onlight ${textLight}`}>{description}</span>
            )}
        </div>
    );
};
