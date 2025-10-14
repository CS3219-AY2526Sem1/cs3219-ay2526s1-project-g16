import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function authFetch(
  url: string,
  options?: RequestInit,
  retry = true,
) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  if (response.status === 401 && retry) {
    // try refreshing token once
    const refresh = await fetch(
      `${import.meta.env.VITE_USER_SERVICE_URL}/user/refresh`,
      {
        method: "POST",
        credentials: "include",
      },
    );

    if (refresh.ok) {
      return await authFetch(url, options, false); // retry original request
    } else {
      throw new Error("Unauthorized");
    }
  }

  return response;
}
