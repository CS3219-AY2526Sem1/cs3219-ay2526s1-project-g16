import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COLLAB_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: Authenticated,
});

function Authenticated() {
  const { auth } = Route.useRouteContext();
  const { user, logout } = auth;
  const navigate = Route.useNavigate();
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const response = await authFetch(
          `${COLLAB_SERVICE_URL}/sessions/active`,
        );
        if (response.ok) {
          const data: { id?: string } = (await response.json()).data;
          if (!data?.id) return;
          setCurrentRoomId(data.id);
          toast.success("Resuming your collaborative session...");
          navigate({ to: "/collab", search: { roomId: data.id } });
        }
      } catch (error) {
        console.error("Error fetching active session:", error);
      }
    })();
  }, [user, navigate]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 border-b p-4 px-6">
        <Link to="/">
          <img src="/logo_wordless.png" width={48} height={48} />
        </Link>

        {currentRoomId && !location.pathname.startsWith("/collab") && (
          <Button variant="secondary">
            <Link to="/collab" search={{ roomId: currentRoomId }}>
              Return to Collaborative Session
            </Link>
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="cursor-pointer">
              <AvatarFallback>{user?.username?.slice(0, 2)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem className="font-medium" asChild>
              <Link to="/user/$userId" params={{ userId: user?.id! }}>
                My Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {user?.isAdmin && (
              <DropdownMenuItem asChild>
                <Link to="/manage-questions">Manage Questions</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                await logout();
                navigate({ to: "/login", search: { redirect: undefined } });
              }}
            >
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <Outlet />
    </>
  );
}
