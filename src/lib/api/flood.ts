import { endpoint } from "@/configs/endpoint";
import { emptyFC } from "@/types";
import type { FloodFC } from "@/types";
// import { apiClient } from "./client";

/**
 * พื้นที่น้ำท่วมตามปี (พ.ศ.).
 *
 * TODO: เชื่อมต่อ backend จริง
 *   return apiClient<FloodFC>(endpoint.flood.byYear(year));
 */
export async function getFlood(year: number): Promise<FloodFC> {
  void endpoint.flood.byYear(year);
  return emptyFC<FloodFC["features"][number]["properties"]>();
}
