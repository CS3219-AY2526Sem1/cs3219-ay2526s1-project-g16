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
  const { user } = auth;
  return (
    <>
      <header className="p-4 border-b flex items-center gap-2">
        <Link to="/">
          <img src="logo_wordless.png" width={48} height={48} />
        </Link>
        <span>{user?.username}</span>
      </header>
      <Outlet />
    </>
  );
}
