import { QuestionsForm } from "@/components/questionsForm";
import { QuestionsTable } from "@/components/questionsTable";
import { Button } from "@/components/ui/button";

import { QN_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import { type ListQuestionsResponse } from "@/types";
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

export type ColumnType = { id: number | undefined; title: string };

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

  const [tempNewQuestions, setTempNewQuestions] = useState<ColumnType[]>([]);
  const columns: ColumnDef<ColumnType>[] = [
    { accessorKey: "id", header: "ID", accessorFn: (row) => row.id ?? "" },
    {
      accessorKey: "title",
      header: "Title",
      accessorFn: (row) => (row.id == null ? "New Question" : row.title),
    },
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
            <div className="w-1/3 border-r flex flex-col justify-between">
              <QuestionsTable
                columns={columns}
                data={[...data.items, ...tempNewQuestions]}
                selectedIndex={selectedIndex}
                setSelectedIndex={setSelectedIndex}
              />
              <Button
                className="m-4"
                onClick={() =>
                  setTempNewQuestions([
                    ...tempNewQuestions,
                    { id: undefined, title: "" },
                  ])
                }
              >
                + Add New Question
              </Button>
            </div>
            <div className="flex items-center justify-center h-150 w-2/3">
              {selectedIndex == null ? (
                <span className="text-neutral-500">No question selected</span>
              ) : (
                <QuestionsForm
                  currentQuestion={data.items[selectedIndex]}
                  setNewQuestion={() => {
                    setTempNewQuestions((prev) =>
                      prev.toSpliced(selectedIndex - data.items.length, 1),
                    );
                    setSelectedIndex(0);
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
