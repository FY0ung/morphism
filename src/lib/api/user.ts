import { apiClient } from "./client";
import { endpoint } from "@/configs/endpoint";
import type { User } from "@/types/user";

export const getUsers = () => apiClient<User[]>(endpoint.user.list);

export const getUser = (id: string) =>
  apiClient<User>(endpoint.user.detail(id));

export const createUser = (payload: Omit<User, "id">) =>
  apiClient<User>(endpoint.user.list, {
    method: "POST",
    body: JSON.stringify(payload),
  });
