import { QuestionsForm } from "@/components/questionsForm";
import { QuestionsTable } from "@/components/questionsTable";
import { Button } from "@/components/ui/button";

import { QN_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import { type ListQuestionsResponse, type ListTopicsResponse } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
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
  const qnsQuery = useQuery<ListQuestionsResponse>({
    queryKey: ["questions"],
    queryFn: async () => {
      const res = await authFetch(`${QN_SERVICE_URL}/questions?take=all`);
      if (!res.ok) {
        throw new Error("Questions response was not ok");
      }
      return res.json();
    },
  });

  const topicsQuery = useQuery<ListTopicsResponse>({
    queryKey: ["topics"],
    queryFn: async () => {
      const res = await authFetch(`${QN_SERVICE_URL}/topics`);
      if (!res.ok) {
        throw new Error("Topics response was not ok");
      }
      return res.json();
    },
  });

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [tempNewQuestions, setTempNewQuestions] = useState<ColumnType[]>([]);

  // TODO: handle pagination correctly (instead of just data.items)
  return (
    <main className="mx-64 my-8 flex flex-col gap-6">
      <h1 className="text-3xl font-medium">Manage Questions</h1>

      <div className="flex h-150  justify-center rounded-md border">
        {qnsQuery.isPending ||
          (topicsQuery.isPending && (
            <div className="self-center">Loading...</div>
          ))}
        {qnsQuery.isError ||
          (topicsQuery.isError && (
            <div className="self-center">
              Error: {(qnsQuery.error ?? topicsQuery.error).message}
            </div>
          ))}
        {qnsQuery.isSuccess && topicsQuery.isSuccess && (
          <>
            <div className="w-1/3 border-r flex flex-col justify-between">
              <div className="overflow-y-auto">
                <QuestionsTable
                  data={[...qnsQuery.data.items, ...tempNewQuestions]}
                  selectedIndex={selectedIndex}
                  setSelectedIndex={setSelectedIndex}
                  removeTempNewQuestion={(index) => {
                    setTempNewQuestions((prev) =>
                      prev.toSpliced(index - qnsQuery.data.items.length, 1),
                    );
                    setSelectedIndex(null);
                  }}
                />
              </div>
              <div className="border-t-1 p-4">
                <Button
                  className="w-full"
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
            </div>
            <div className="flex items-center justify-center w-2/3">
              {selectedIndex == null ? (
                <span className="text-neutral-500">No question selected</span>
              ) : (
                <QuestionsForm
                  currentQuestion={qnsQuery.data.items[selectedIndex]}
                  setNewQuestion={() => {
                    setTempNewQuestions((prev) =>
                      prev.toSpliced(
                        selectedIndex - qnsQuery.data.items.length,
                        1,
                      ),
                    );
                    setSelectedIndex(0);
                  }}
                  topics={topicsQuery.data.topics}
                />
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
