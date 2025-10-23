import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_unauthenticated")({
  component: Unauthenticated,
});

function Unauthenticated() {
  return (
    <>
      <header>unauthenticated header</header>
      <div className="flex h-full flex-col">
        <div className="grow-2 flex flex-col items-center justify-center gap-10">
          <img src="logo.png" width={100} height={100} />
          <Outlet />
        </div>
        {/* Spacer to push content towards the top */}
        <div className="grow-1" />
      </div>
    </>
  );
}
