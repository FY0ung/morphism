"use client";

import React from "react";

export type AvatarType = "moldablemoji" | "initials";
export type AvatarSize = "large" | "medium" | "small";
export type AvatarShape = "circle" | "square";

export interface AvatarProps {
  type?: AvatarType;
  src?: string;                // สำหรับ moldablemoji
  initials?: string;           // สำหรับ initials
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
  overlap?: boolean;           // ⭐ ใช้ซ้อนกันด้วย spacing -16px
}

export const Avatar: React.FC<AvatarProps> = ({
  type = "initials",
  src,
  initials = "",
  size = "medium",
  shape = "circle",
  className,
  overlap = false,
}) => {
  const sizeClasses: Record<AvatarSize, string> = {
    large: "w-10 h-10 text-base",  // 40px
    medium: "w-8 h-8 text-sm",     // 32px
    small: "w-6 h-6 text-sm",      // 24px
  };

  const shapeClasses: Record<AvatarShape, string> = {
    circle: "rounded-full",
    square: "rounded-lg",
  };

  const base =
    "flex items-center justify-center font-semibold bg-background-primary-default text-text-primary-default overflow-hidden select-none";

  const overlapClass = overlap ? "-ml-4" : ""; // ⭐ -16px

  return (
    <div
      className={`${base} ${sizeClasses[size]} ${shapeClasses[shape]} ${overlapClass} ${
        className ?? ""
      }`}
    >
      {/* ⭐ Type 1: Image Avatar (MoldableMoji) */}
      {type === "moldablemoji" && src ? (
        <img
          src={src}
          alt="avatar"
          className="w-full h-full object-cover bg-text-default-default"
        />
      ) : null}

      {/* ⭐ Type 2: Initials Avatar */}
      {type === "initials" && (
        <span className="uppercase">{initials}</span>
      )}
    </div>
  );
};
