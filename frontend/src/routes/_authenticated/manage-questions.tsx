import { QuestionsForm } from "@/components/questionsForm";
import { QuestionsTable } from "@/components/questionsTable";

import { QN_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import { type ListQuestionsResponse, type Question } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { type ColumnDef } from "@tanstack/react-table";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/manage-questions")({
  beforeLoad: ({ context }) => {
    if (!context.auth.user?.isAdmin) {
      throw redirect({ to: "/", search: { redirect: undefined } });
    }
  },
  component: ManageQuestions,
});

function ManageQuestions() {
  const { isPending, isError, isSuccess, data, error } =
    useQuery<ListQuestionsResponse>({
      queryKey: ["questions"],
      queryFn: async () => {
        const res = await authFetch(QN_SERVICE_URL);
        if (!res.ok) {
          throw new Error("Network response was not ok");
        }
        return res.json();
      },
    });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const columns: ColumnDef<Pick<Question, "id" | "title">>[] = [
    { accessorKey: "id", header: "ID" },
    { accessorKey: "title", header: "Title" },
  ];

  // TODO: handle pagination correctly (instead of just data.items)
  return (
    <main className="mx-64 my-8 flex flex-col gap-6">
      <h1 className="text-3xl font-medium">Manage Questions</h1>

      <div className="flex justify-center rounded-md border">
        {isPending && <div className="self-center">Loading...</div>}
        {isError && <div className="self-center">Error: {error.message}</div>}
        {isSuccess && (
          <>
            <div className="w-1/3 border-r">
              <QuestionsTable
                columns={columns}
                data={data?.items ?? []}
                selectedIndex={selectedIndex}
                setSelectedIndex={setSelectedIndex}
              />
            </div>
            {selectedIndex == null ? (
              <div className="m-8 flex w-2/3 items-center justify-center text-neutral-500">
                No question selected
              </div>
            ) : (
              <QuestionsForm currentQuestion={data.items[selectedIndex]} />
            )}
            {/* </div> */}
          </>
        )}
      </div>
    </main>
  );
}
