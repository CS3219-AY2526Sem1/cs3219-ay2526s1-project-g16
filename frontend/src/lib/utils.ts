import { ACCESS_TOKEN } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function authFetch(url: string, options?: RequestInit) {
  const token = localStorage.getItem(ACCESS_TOKEN);
  return fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: token ? `Bearer ${token}` : "",
    },
  });
}
