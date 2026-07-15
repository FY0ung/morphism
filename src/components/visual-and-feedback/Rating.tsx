"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/icons";

export type RatingSize = "large" | "medium" | "small";

export interface RatingProps {
  max?: number;
  size?: RatingSize;
  readOnly?: boolean;
  className?: string;
  defaultValue?: number;   // ⭐ เพิ่ม defaultValue
}

/* SIZE MAP */
const sizeMap: Record<RatingSize, string> = {
  large: "w-8 h-8",
  medium: "w-6 h-6",
  small: "w-4 h-4",
};

export const Rating: React.FC<RatingProps> = ({
  max = 5,
  size = "medium",
  readOnly = false,
  className,
  defaultValue = 0,     // ⭐ ตั้ง default = 0
}) => {
  const [rating, setRating] = useState<number>(defaultValue);   // ⭐ ใช้ defaultValue
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const stars = Array.from({ length: max }, (_, i) => i + 1);

  /* CLICK */
  const handleClick = (v: number) => {
    if (readOnly) return;

    if (rating === v) {
      setRating(v - 0.5); 
      return;
    }

    if (rating === v - 0.5) {
      setRating(v - 1);
      return;
    }

    setRating(v);
  };

  /* HOVER */
  const handleHover = (
    e: React.MouseEvent<HTMLButtonElement>,
    starValue: number
  ) => {
    if (readOnly) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;

    setHoverValue(isLeft ? starValue - 0.4 : starValue);
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {stars.map((star) => {
        const displayValue = hoverValue ?? rating;

        const isFull = displayValue >= star;
        const isHalf = !isFull && displayValue >= star - 0.5;

        return (
          <motion.button
            key={star}
            type="button"
            onMouseMove={(e) => handleHover(e, star)}
            onMouseLeave={() => setHoverValue(null)}
            onClick={() => handleClick(star)}
            className={`relative ${
              readOnly ? "cursor-default" : "cursor-pointer"
            } bg-transparent p-0 border-none`}
          >
            {/* placeholder */}
            <div className={`opacity-0 pointer-events-none ${sizeMap[size]}`}>
              <Icon name="Star02" />
            </div>

            {/* EMPTY STAR */}
            <Icon
              name="Star02"
              className={`fill-background-warning-disable absolute inset-0 z-0 ${sizeMap[size]}`}
            />

            {/* HALF STAR */}
            {isHalf && (
              <motion.div
                className="absolute inset-0 z-20 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="w-1/2 h-full overflow-hidden">
                  <Icon
                    name="Star02"
                    className={`fill-background-warning-default ${sizeMap[size]}`}
                  />
                </div>
              </motion.div>
            )}

            {/* FULL STAR */}
            {isFull && (
              <motion.div
                className="absolute inset-0 z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Icon
                  name="Star02"
                  className={`fill-background-warning-default ${sizeMap[size]}`}
                />
              </motion.div>
            )}
          </motion.button>
        );
      })}
    </div>
  );
};
