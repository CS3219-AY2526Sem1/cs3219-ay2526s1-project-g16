import { Toaster } from "@/components/ui/sonner";
import type { AuthContextType } from "@/hooks/useAuth";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

type RouterContext = {
  auth: AuthContextType;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster position="bottom-center" />
    </>
  ),
});
