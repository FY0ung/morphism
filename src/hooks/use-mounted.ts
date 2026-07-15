"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns true after the component has mounted on the client.
 * Useful for theme/locale-dependent UI to avoid hydration mismatches.
 * Implemented with useSyncExternalStore (server snapshot = false, client
 * snapshot = true) — no setState-in-effect, identical false→true behavior.
 */
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
