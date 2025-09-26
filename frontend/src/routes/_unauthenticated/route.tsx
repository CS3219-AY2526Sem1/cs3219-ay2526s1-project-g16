import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_unauthenticated")({
  component: App,
});

function App() {
  return (
    <>
      <header>unauthenticated header</header>
      <div className="w-full h-full flex flex-col items-center mt-20 gap-10">
        <img src="logo.png" width={100} height={100} />
        <Outlet />
      </div>
    </>
  );
}
