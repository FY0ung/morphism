"use client";
import React, { createContext, useContext, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/* -------------------------------------------------- */
/* Types & Context                                     */
/* -------------------------------------------------- */
type Placement = "top" | "bottom" | "left" | "right";

interface TooltipContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  placement: Placement;
}

const TooltipContext = createContext<TooltipContextValue | null>(null);

const useTooltip = () => {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error("Tooltip.* must be inside <Tooltip>");
  return ctx;
};

/* -------------------------------------------------- */
/* Root                                                */
/* -------------------------------------------------- */
export const Tooltip = ({
  children,
  placement = "top",
}: {
  children: React.ReactNode;
  placement?: Placement;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <TooltipContext.Provider value={{ open, setOpen, placement }}>
      {children}
    </TooltipContext.Provider>
  );
};

/* -------------------------------------------------- */
/* Trigger (ANCHOR)                                    */
/* -------------------------------------------------- */
Tooltip.Trigger = function TooltipTrigger({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setOpen } = useTooltip();
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {/* Content MUST live here */}
      <Tooltip.Content />
    </div>
  );
};

/* -------------------------------------------------- */
/* Content                                             */
/* -------------------------------------------------- */
Tooltip.Content = function TooltipContent({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { open, placement } = useTooltip();

  if (!children) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className={cn(
            "absolute z-50 pointer-events-none",
            contentPlacementMap[placement]
          )}
        >
          <div
            className={cn(
              "bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg relative",
              className
            )}
          >
            {children}
            <Tooltip.Arrow />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* -------------------------------------------------- */
/* Arrow (SVG – โค้งมน)                               */
/* -------------------------------------------------- */
Tooltip.Arrow = function TooltipArrow({
  className,
}: {
  className?: string;
}) {
  const { placement } = useTooltip();
  const arrowPlacement = getArrowPlacement(placement);

  return (
    <svg
      width="16"
      height="8"
      viewBox="0 0 16 8"
      className={cn(
        "absolute fill-gray-900",
        arrowPlacementMap[arrowPlacement],
        className
      )}
    >
      <path d="M0 8 Q8 0 16 8Z" />
    </svg>
  );
};

/* -------------------------------------------------- */
/* Helpers                                             */
/* -------------------------------------------------- */
/** ลูกศรต้องชี้ "กลับด้าน" จาก content เสมอ */
const getArrowPlacement = (placement: Placement): Placement => {
  switch (placement) {
    case "top":
      return "bottom";
    case "bottom":
      return "top";
    case "left":
      return "right";
    case "right":
      return "left";
    default:
      return "top";
  }
};

/* -------------------------------------------------- */
/* Placement Maps                                      */
/* -------------------------------------------------- */
const contentPlacementMap: Record<Placement, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowPlacementMap: Record<Placement, string> = {
  // Arrow points DOWN (tooltip is above)
  bottom: "left-1/2 -translate-x-1/2 -bottom-2",
  // Arrow points UP (tooltip is below)
  top: "left-1/2 -translate-x-1/2 -top-2 rotate-180",
  // Arrow points RIGHT (tooltip is on left)
  right: "top-1/2 -translate-y-1/2 -right-2 rotate-90",
  // Arrow points LEFT (tooltip is on right)
  left: "top-1/2 -translate-y-1/2 -left-2 -rotate-90",
};