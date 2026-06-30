"use client";

import React from "react";
import { cn } from "@/lib/utils";

/* Root */
const TableRoot: React.FC<{
  children: React.ReactNode;
  className?: string;
  selectable?: boolean;
}> = ({ children, className }) => (
  <div
    className={cn(
      "w-full bg-background-default-default rounded-2xl overflow-hidden border border-border-default-default",
      className
    )}
  >
    {children}
  </div>
);

/* Header */
const TableHeader: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => (
  <div
    className={cn(
      "grid px-4 h-12 items-center bg-background-default-light border-b border-border-default-default",
      className
    )}
  >
    {children}
  </div>
);

/* Row */
const TableRow: React.FC<{
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}> = ({ children, className, selected, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      "grid px-4 py-2 min-h-12 h-auto items-center transition-colors",
      selected
        ? "bg-background-default-active"
        : "hover:bg-background-default-hover",
      className
    )}
  >
    {children}
  </div>
);

/* Cell */
type CellType = "default" | "checkbox" | "actions";

interface TableCellProps {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
  type?: CellType;
  className?: string;
}

const TableCell: React.FC<TableCellProps> = ({
  children,
  align = "left",
  type = "default",
  className,
}) => {
  return (
    <div
      className={cn(
        "text-sm text-text-default-default wrap-break-word",
        align === "center" && "text-center",
        align === "right" && "text-right",
        type === "checkbox" && "flex justify-center",
        type === "actions" && "flex justify-center",
        className
      )}
    >
      {children}
    </div>
  );
};

/* Body */
const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="divide-y divide-border-default-default">{children}</div>
);

/* Footer */
const TableFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center justify-between px-4 py-3 border-t border-border-default-default">
    {children}
  </div>
);

export const Table = {
  Root: TableRoot,
  Header: TableHeader,
  Body: TableBody,
  Row: TableRow,
  Cell: TableCell,
  Footer: TableFooter,
};
