"use client";

import React from "react";

/* ------------------------------------------
 * Thumbnail Skeleton
 * ----------------------------------------*/

export type SkeletonThumbnailSize =
  | "ExtraSmall"   
  | "Small"   
  | "Medium"   
  | "Large"   
  | "ExtraLarge";  

export interface SkeletonThumbnailProps {
  size?: SkeletonThumbnailSize;
  shape?: "circle" | "rounded";
  className?: string;
}

const thumbnailSizeMap: Record<SkeletonThumbnailSize, string> = {
  ExtraSmall: "w-6 h-6 rounded-lg",  // 24px
  Small: "w-8 h-8 rounded-lg",   // 32px
  Medium: "w-10 h-10 rounded-xl", // 40px
  Large: "w-16 h-16 rounded-2xl", // 64px
  ExtraLarge: "w-20 h-20 rounded-3xl", // 80px
};

export const SkeletonThumbnail: React.FC<SkeletonThumbnailProps> = ({
  size = "Medium",
  shape = "rounded",
  className,
}) => {
  return (
    <div
      className={`
        gradient-2
        animate-pulse
        ${thumbnailSizeMap[size]}
        ${shape === "circle" ? "rounded-full" : "thumbnailSizeMap"}
        ${className ?? ""}
      `}
    />
  );
};

/* ------------------------------------------
 * Display Text Skeleton  (ใช้แทน Title / Heading)
 * ----------------------------------------*/

export type SkeletonDisplaySize = "Large" | "Medium" | "Small" | "ExtraSmall";

export interface SkeletonDisplayTextProps {
  size?: SkeletonDisplaySize;
  /** ความกว้างของเส้น (Tailwind width classes) */
  widthClassName?: string;
  className?: string;
}

const displayHeightMap: Record<SkeletonDisplaySize, string> = {
  Large: "h-10 rounded-xl", // ประมาณ text-4xl
  Medium: "h-8 rounded-lg",
  Small: "h-6 rounded-lg",
  ExtraSmall: "h-4 rounded-sm",
};

export const SkeletonDisplayText: React.FC<SkeletonDisplayTextProps> = ({
  size = "ExtraSmall",
  widthClassName,
  className,
}) => {
  const width = widthClassName ?? "w-48"; // default ~12rem

  return (
    <div
      className={`
        gradient-2
        animate-pulse 
        rounded-full 
        ${displayHeightMap[size]} 
        ${width}
        ${className ?? ""}
      `}
    />
  );
};

/* ------------------------------------------
 * Lines Skeleton  (Paragraph 1–6 บรรทัด)
 * ----------------------------------------*/

export interface SkeletonLinesProps {
  /** จำนวนบรรทัด 1–6 */
  lines?: number;
  /** ให้บรรทัดสุดท้ายสั้นลงเล็กน้อย (ดูเป็นธรรมชาติ) */
  shortLastLine?: boolean;
  className?: string;
}

const lineWidths = [
  "w-full",
  "w-11/12",
  "w-10/12",
  "w-9/12",
  "w-3/4",
  "w-2/3",
];

export const SkeletonLines: React.FC<SkeletonLinesProps> = ({
  lines = 3,
  shortLastLine = true,
  className,
}) => {
  const count = Math.min(Math.max(lines, 1), 6);

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      {Array.from({ length: count }).map((_, index) => {
        const isLast = index === count - 1;

        const widthClass = shortLastLine && isLast
          ? lineWidths[Math.min(count, lineWidths.length) - 1] // ทำบรรทัดสุดท้ายสั้นลง
          : "w-full";

        return (
          <div
            key={index}
            className={`
              h-3 
              gradient-2
              animate-pulse 
              rounded-full 
              ${widthClass}
            `}
          />
        );
      })}
    </div>
  );
};

/* ------------------------------------------
 * Generic Skeleton (เผื่ออยากใช้ครอบเอง)
 * ----------------------------------------*/

export interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div
    className={`
      bg-background-default-disable/70 
      animate-pulse 
      rounded-md 
      ${className ?? ""}
    `}
  />
);
