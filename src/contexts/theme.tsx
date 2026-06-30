"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

// Defaults are applied first so anything passed from the layout (attribute,
// defaultTheme, enableSystem) wins.
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider disableTransitionOnChange {...props}>
      {children}
    </NextThemesProvider>
  );
}
