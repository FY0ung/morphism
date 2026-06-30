"use client";

import { useEffect, useState } from "react";

/**
 * Returns true after the component has mounted on the client.
 * Useful for theme/locale-dependent UI to avoid hydration mismatches.
 */
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
