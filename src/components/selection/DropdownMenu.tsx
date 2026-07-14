"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Divider } from "../structural-and-layout/Divider";

/* -------------------------------------------------- */
/* Context                                            */
/* -------------------------------------------------- */
interface DropdownContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

const useDropdown = () => {
  const ctx = useContext(DropdownContext);
  if (!ctx) {
    throw new Error("Dropdown.* must be used inside Dropdown.Root");
  }
  return ctx;
};

/* -------------------------------------------------- */
/* Root                                               */
/* -------------------------------------------------- */
const DropdownRoot: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // click outside = close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div
        ref={ref}
        className={`relative inline-flex ${className ?? ""}`}
        // Escape closes the menu from anywhere inside (trigger or items).
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  );
};

/* -------------------------------------------------- */
/* Trigger                                            */
/* -------------------------------------------------- */
type TriggerChild =
  | React.ReactElement<{ onClick?: React.MouseEventHandler }>
  | ((open: boolean) => React.ReactElement<{ onClick?: React.MouseEventHandler }>);

const DropdownTrigger: React.FC<{ children: TriggerChild }> = ({ children }) => {
  const { open, setOpen } = useDropdown();

  const child =
    typeof children === "function" ? children(open) : children;

  return React.cloneElement(child, {
    onClick: (e: React.MouseEvent) => {
      child.props.onClick?.(e);
      setOpen((v) => !v);
    },
  });
};

/* -------------------------------------------------- */
/* Content                                            */
/* -------------------------------------------------- */
const DropdownContent: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Horizontal anchor: "start" (left edge, default) or "end" (right edge). */
  align?: "start" | "end";
}> = ({ children, className, align = "start" }) => {
  const { open } = useDropdown();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<"bottom" | "top">("bottom");

  useEffect(() => {
    if (!open) return;
    const el = menuRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const viewport = window.innerHeight;

    if (rect.bottom > viewport && rect.top > rect.height) {
      setPosition("top");
    } else {
      setPosition("bottom");
    }
  }, [open]);

  if (!open) return null;

  const side = align === "end" ? "right-0" : "left-0";

  return (
    <div
      ref={menuRef}
      role="menu"
      className={`
        absolute z-30
        min-w-full w-max whitespace-nowrap
        rounded-3xl p-2
        bg-background-default-default
        dropshadow-200
        animate-in fade-in
        ${
          position === "bottom"
            ? `${side} top-full mt-2`
            : `${side} bottom-full mb-2`
        }
        ${className ?? ""}
      `}
    >
      {children}
    </div>
  );
};

/* -------------------------------------------------- */
/* Section                                            */
/* -------------------------------------------------- */
const DropdownSection: React.FC<{
  title?: string;
  children: React.ReactNode;
  showDivider?: boolean;
  className?: string;
}> = ({ title, children, showDivider = false, className }) => {
  return (
    <div className={`flex flex-col w-full ${className ?? ""}`}>
      {title && (
        <div className="flex flex-col px-3 py-2 gap-2 text-sm text-text-default-disable">
          {title}
          {showDivider && (
            <Divider
              orientation="horizontal"
              className="border-b-background-default-light"
            />
          )}
        </div>
      )}

      {children}

      {showDivider && <div className="h-px bg-border-default-light" />}
    </div>
  );
};

/* -------------------------------------------------- */
/* Item                                               */
/* -------------------------------------------------- */
interface DropdownItemProps {
  item: string;
  iconStart?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  className?: string;
}

const DropdownItem: React.FC<DropdownItemProps> = ({
  item,
  iconStart,
  shortcut,
  onClick,
  className,
}) => {
  const { setOpen } = useDropdown();

  const activate = () => {
    onClick?.();
    setOpen(false);
  };

  return (
    <div
      role="menuitem"
      tabIndex={0}
      className={`
        flex items-center justify-between gap-6
        px-3 py-2 rounded-full cursor-pointer
        hover:bg-background-default-hover
        focus-visible:outline-2 focus-visible:outline-border-primary-default
        whitespace-nowrap  /* ⭐ กัน item แตกบรรทัด */
        ${className ?? ""}
      `}
      onClick={activate}
      // Keyboard activation (Enter/Space) — menu items must be operable
      // without a pointer.
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      }}
    >
      <div className="flex items-center gap-2">
        {iconStart}
        <span className="text-sm">{item}</span>
      </div>

      <div className="hidden md:block">
        {shortcut && (
          <span
            className={`
              flex items-center text-xs px-2 py-1 h-4.5 text-text-default-onlight bg-background-default-default border-border-default-default rounded-md border
            `}
          >
            {shortcut}
          </span>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------- */
/* Namespace Export                                   */
/* -------------------------------------------------- */
export const Dropdown = {
  Root: DropdownRoot,
  Trigger: DropdownTrigger,
  Content: DropdownContent,
  Section: DropdownSection,
  Item: DropdownItem,
};
