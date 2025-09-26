import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_unauthenticated")({
  component: App,
});

function App() {
  return (
    <>
      <header>unauthenticated header</header>
      <div className="w-full h-full flex flex-col items-center mt-24 gap-12">
        <img src="logo.png" width={128} height={128} />
        <Outlet />
      </div>
    </>
  );
}
