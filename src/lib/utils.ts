import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function localStorageAvailable() {
  try {
    const key = "__some_random_key_you_are_not_going_to_use__";
    window.localStorage.setItem(key, key);
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    return false;
  }
}

export function localStorageGetItem(key: string, defaultValue = "") {
  const storageAvailable = localStorageAvailable();

  let value;

  if (storageAvailable) {
    value = localStorage.getItem(key) ?? defaultValue;
  }

  try {
    if (value === null) {
      return defaultValue
    }
    if (value) {
      return JSON.parse(value)
    }
    return defaultValue
  } catch (error) {
    return null;
  }
}

/** Persist a JSON-serialisable value under `key` (no-op if storage unavailable). */
export function localStorageSetItem(key: string, value: unknown) {
  if (!localStorageAvailable()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / serialisation errors are non-fatal */
  }
}