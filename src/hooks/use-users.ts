"use client";

import { useCallback, useEffect, useState } from "react";
import { getUsers } from "@/lib/api";
import type { User } from "@/types";

// ใช้เฉพาะกรณีต้อง fetch ฝั่ง client (loading/error/refetch)
// ถ้าดึงข้อมูลตอน render หน้า ให้เรียก service ใน Server Component ของ section แทน
export function useUsers() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getUsers());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  return { data, loading, error, refetch: fetchUsers };
}
