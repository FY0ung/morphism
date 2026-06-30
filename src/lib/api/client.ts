import { API_BASE_URL } from "@/configs/endpoint";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * ตัวเชื่อมต่อ API กลาง — แหล่งเดียวที่คุยกับ backend จริง
 * service ต่อ resource ควรเรียกผ่านฟังก์ชันนี้ ไม่ fetch กระจายใน component
 */
export async function apiClient<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new ApiError(res.status, `API request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
