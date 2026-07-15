"use client";

import { useCallback, useEffect, useState } from "react";
import { getUsers } from "@/lib/api";
import type { User } from "@/types";

// ใช้เฉพาะกรณีต้อง fetch ฝั่ง client (loading/error/refetch)
// ถ้าดึงข้อมูลตอน render หน้า ให้เรียก service ใน Server Component ของ section แทน
export function useUsers() {
  const [data, setData] = useState<User[]>([]);
  // Starts true (the mount effect fetches immediately) — no synchronous
  // setState inside the effect body; every update lands after an await.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await getUsers());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred a tick so no state update can be attributed to the effect's
    // synchronous execution (react-hooks/set-state-in-effect).
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  /** Manual refetch (event handlers) — shows the loading state again. */
  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    await load();
  }, [load]);

  return { data, loading, error, refetch };
}
