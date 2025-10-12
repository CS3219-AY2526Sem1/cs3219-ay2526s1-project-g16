import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_unauthenticated")({
  component: Unauthenticated,
});

function Unauthenticated() {
  return (
    <>
      <header>unauthenticated header</header>
      <div className="h-full flex flex-col">
        <div className="flex flex-col items-center justify-center grow-2 gap-10">
          <img src="logo.png" width={100} height={100} />
          <Outlet />
        </div>
        {/* Spacer to push content towards the top */}
        <div className="grow-1" />
      </div>
    </>
  );
}
