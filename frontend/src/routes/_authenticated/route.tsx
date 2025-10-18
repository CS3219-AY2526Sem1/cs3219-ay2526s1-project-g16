import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";

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
  return (
    <>
      <header className="flex items-center justify-between gap-2 border-b p-4 px-6">
        <Link to="/">
          <img src="logo_wordless.png" width={48} height={48} />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Avatar className="cursor-pointer">
              <AvatarFallback>{user?.username?.slice(0, 2)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {user?.isAdmin && (
              <DropdownMenuItem>
                <Link to="/manage-questions">Manage Questions</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="font-medium text-red-500 data-[highlighted]:text-red-600"
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
