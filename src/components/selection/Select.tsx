"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Checkbox } from "@/components/forms-and-input/Checkbox";
import { Avatar, AvatarProps } from "@/components/visual-and-feedback/Avatar";
import { Button, ButtonProps } from "@/components/actionable/Buttons";
import { cn } from "@/lib/utils";

/* -------------------------------------------------- */
/* Types                                              */
/* -------------------------------------------------- */
export type SelectMode = "single" | "multiple";
export type SelectItemState = "default" | "disabled";

/* -------------------------------------------------- */
/* Context                                            */
/* -------------------------------------------------- */
interface SelectContextValue {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;

  mode: SelectMode;

  value?: string;
  onValueChange?: (v: string) => void;

  values: string[];
  onValuesChange?: (v: string[]) => void;

  isSelected: (v: string) => boolean;
  selectValue: (v: string) => void;
  removeValue: (v: string) => void;

  /** ✅ auto placement */
  placement: "top" | "bottom";
}

const SelectContext = createContext<SelectContextValue | null>(null);

const useSelect = () => {
  const ctx = useContext(SelectContext);
  if (!ctx) throw new Error("Select.* must be used inside Select.Root");
  return ctx;
};

/* -------------------------------------------------- */
/* Root                                               */
/* -------------------------------------------------- */
export interface SelectRootProps {
  children: React.ReactNode;
  className?: string;

  mode?: SelectMode;
  multiple?: boolean;

  value?: string;
  onValueChange?: (v: string) => void;

  values?: string[];
  onValuesChange?: (v: string[]) => void;
}

const SelectRoot: React.FC<SelectRootProps> = ({
  children,
  className,
  mode,
  multiple,
  value,
  onValueChange,
  values,
  onValuesChange,
}) => {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");

  const ref = useRef<HTMLDivElement>(null);

  /* close when click outside */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ✅ auto detect placement */
  useEffect(() => {
    if (!open || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const DROPDOWN_HEIGHT = 240; // ประมาณความสูง dropdown
    const spaceBelow = window.innerHeight - rect.bottom;

    setPlacement(spaceBelow < DROPDOWN_HEIGHT ? "top" : "bottom");
  }, [open]);

  const resolvedMode: SelectMode = useMemo(() => {
    if (mode) return mode;
    if (multiple) return "multiple";
    if (Array.isArray(values)) return "multiple";
    return "single";
  }, [mode, multiple, values]);

  const safeValues = useMemo(
    () => (Array.isArray(values) ? values : []),
    [values]
  );

  const isSelected = (v: string) =>
    resolvedMode === "multiple" ? safeValues.includes(v) : value === v;

  const selectValue = (v: string) => {
    if (resolvedMode === "multiple") {
      if (!onValuesChange) return;
      const next = safeValues.includes(v)
        ? safeValues.filter((x) => x !== v)
        : [...safeValues, v];
      onValuesChange(next);
      return;
    }

    if (!onValueChange) return;
    onValueChange(v);
    setOpen(false);
  };

  const removeValue = (v: string) => {
    if (resolvedMode === "multiple") {
      if (!onValuesChange) return;
      onValuesChange(safeValues.filter((x) => x !== v));
      return;
    }
    onValueChange?.("");
  };

  return (
    <SelectContext.Provider
      value={{
        open,
        setOpen,
        mode: resolvedMode,
        value,
        onValueChange,
        values: safeValues,
        onValuesChange,
        isSelected,
        selectValue,
        removeValue,
        placement,
      }}
    >
      <div ref={ref} className={cn("relative w-full", className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
};

/* -------------------------------------------------- */
/* Trigger                                            */
/* -------------------------------------------------- */
type TriggerChild =
  | React.ReactElement<{ onClick?: React.MouseEventHandler }>
  | ((open: boolean) => React.ReactElement<{ onClick?: React.MouseEventHandler }>);

const SelectTrigger: React.FC<{ children: TriggerChild }> = ({ children }) => {
  const { open, setOpen } = useSelect();
  const child = typeof children === "function" ? children(open) : children;

  return React.cloneElement(child, {
    onClick: (e: React.MouseEvent) => {
      child.props.onClick?.(e);
      setOpen((v) => !v);
    },
  });
};

/* -------------------------------------------------- */
/* Content (Dropdown – auto flip)                     */
/* -------------------------------------------------- */
const SelectContent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { open, placement } = useSelect();
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute z-50 w-full rounded-2xl p-2 bg-background-default-default dropshadow-200",
        placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
      )}
    >
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
};

/* -------------------------------------------------- */
/* List (always visible)                              */
/* -------------------------------------------------- */
const SelectList: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl p-2 bg-background-default-default">
    <div className="flex flex-col gap-1">{children}</div>
  </div>
);

/* -------------------------------------------------- */
/* Section                                            */
/* -------------------------------------------------- */
const SelectSection: React.FC<{
  title?: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="flex flex-col gap-1">
    {title && (
      <div className="px-3 py-1 text-xs text-text-default-disable">
        {title}
      </div>
    )}
    {children}
  </div>
);

/* -------------------------------------------------- */
/* Value                                              */
/* -------------------------------------------------- */
interface SelectValueProps {
  placeholder?: React.ReactNode;
  renderItem?: (v: string) => React.ReactNode;
  removable?: boolean;
}

const SelectValue: React.FC<SelectValueProps> = ({
  placeholder = (
    <span className="text-text-default-onlight">Select...</span>
  ),
  renderItem,
  removable = false,
}) => {
  const { mode, value, values, removeValue } = useSelect();

  if (mode === "single") {
    if (!value) return <>{placeholder}</>;
    return <>{renderItem ? renderItem(value) : value}</>;
  }

  if (!values.length) return <>{placeholder}</>;

  return (
    <div className="flex gap-1 overflow-x-auto whitespace-nowrap">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {renderItem ? renderItem(v) : v}
          {removable && (
            <button
              type="button"
              onClick={() => removeValue(v)}
              className="text-text-default-onlight"
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
};

/* -------------------------------------------------- */
/* Item                                               */
/* -------------------------------------------------- */
export interface SelectItemProps {
  value?: string;
  item: string;
  state?: SelectItemState;
  checkbox?: boolean;
  avatar?: AvatarProps;
  iconStart?: React.ReactNode;
  shortcut?: string;
  iconEnd?: React.ReactNode;
  button?: {
    props?: ButtonProps;
    children: React.ReactNode;
  };
}

const SelectItem: React.FC<SelectItemProps> = ({
  value,
  item,
  state = "default",
  checkbox,
  avatar,
  iconStart,
  shortcut,
  iconEnd,
  button,
}) => {
  const ctx = useSelect();
  const resolvedValue = value ?? item;
  const disabled = state === "disabled";
  const selected = ctx.isSelected(resolvedValue);

  return (
    <div
      onClick={() => !disabled && ctx.selectValue(resolvedValue)}
      className={cn(
        "flex items-center justify-between gap-3 px-3 py-2 h-10 rounded-full",
        selected
          ? "bg-background-default-active"
          : "hover:bg-background-default-hover",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <div className="flex items-center gap-3">
        {checkbox && (
          <Checkbox
            value={selected ? "checked" : "unchecked"}
            state={disabled ? "disabled" : "default"}
          />
        )}
        {avatar && <Avatar {...avatar} size="small" />}
        {iconStart}
        <span className="text-sm">{item}</span>
      </div>

      <div className="flex items-center gap-2">
        {shortcut && (
          <span className="text-xs text-text-default-onlight">
            {shortcut}
          </span>
        )}
        {iconEnd}
        {button && (
          <Button
            {...button.props}
            onClick={(e) => {
              e.stopPropagation();
              button.props?.onClick?.(e);
            }}
          >
            {button.children}
          </Button>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------- */
/* Export                                             */
/* -------------------------------------------------- */
export const Select = {
  Root: SelectRoot,
  Trigger: SelectTrigger,
  Content: SelectContent,
  List: SelectList,
  Section: SelectSection,
  Item: SelectItem,
  Value: SelectValue,
};
