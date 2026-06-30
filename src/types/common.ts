import type { ReactNode } from "react";

/** Props for components that simply wrap children. */
export interface ChildrenProps {
  children?: ReactNode;
}

/** A generic option used by selects, menus, tabs, etc. */
export interface Option<T = string> {
  label: string;
  value: T;
  disabled?: boolean;
}
