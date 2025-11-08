import { QN_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import type { Question } from "@/types";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";

export function CodeEditor({
  sessionLang,
  qid,
  actionButtons,
  containerRef,
  status,
  authRequired,
}: {
  sessionLang?: string;
  qid: string;
  actionButtons?: React.ReactElement;
  containerRef: React.RefObject<HTMLDivElement | null>;
  status?: string;
  authRequired?: boolean;
}) {
  const [showSolution, setShowSolution] = useState(false);

  const questionQ = useQuery({
    queryKey: ["collab-question", qid],
    enabled: !!qid,
    retry: 0,
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<Question> => {
      const res = await authFetch(
        `${QN_SERVICE_URL}/questions/${encodeURIComponent(qid)}`,
        {
          method: "GET",
          headers: { Accept: "application/json" },
        },
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Question fetch failed: ${res.status} ${text}`);
      }
      return await res.json();
    },
  });

  const title =
    questionQ.data?.title ??
    (questionQ.isLoading
      ? "Loading question…"
      : qid
        ? "Question unavailable"
        : "Unavailable Room.");

  const statement =
    questionQ.data?.statement ??
    (questionQ.isError
      ? "Failed to load question."
      : qid
        ? "Fetching question…"
        : "Unavailable room. Please try to get a Match again.");

  const ex = questionQ.data?.exampleIO?.[0];
  const ein = ex?.input ?? "";
  const eout = ex?.output ?? "";

  const topicNames = useMemo(() => {
    const names =
      questionQ.data?.topics
        ?.map((t) => t.topic?.name)
        .filter((n): n is string => !!n) ?? [];
    return Array.from(new Set(names));
  }, [questionQ.data?.topics]);

  return (
    <>
      <div className="mt-3 flex flex-col gap-3 lg:flex-row">
        {/* Question Card */}
        <Card className="h-[70vh] w-full overflow-hidden lg:w-[38%]">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-2xl font-semibold">{title}</div>

              {/* Language badge */}
              {sessionLang && (
                <span className="rounded-full border px-2 py-0.5 text-xs uppercase tracking-wide">
                  {sessionLang}
                </span>
              )}

              <div className="ml-auto" />

              {actionButtons}
            </div>

            {topicNames.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {topicNames.map((name) => (
                  <span
                    key={name}
                    className="text-muted-foreground rounded-full border px-2 py-0.5 text-xs"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {questionQ.data?.difficulty && (
              <div className="text-muted-foreground mt-1 text-xs uppercase tracking-wide">
                {questionQ.data.difficulty}
              </div>
            )}

            {questionQ.isLoading && (
              <div className="text-muted-foreground mt-2 text-xs">Loading…</div>
            )}
          </CardHeader>

          <CardContent className="h-full overflow-y-auto whitespace-pre-wrap">
            {questionQ.isError && (
              <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
                {(questionQ.error as Error)?.message ||
                  "Failed to load question."}
              </div>
            )}

            {statement}

            {questionQ.data?.constraints?.length ? (
              <div className="mt-4">
                <div className="mb-1 font-semibold">Constraints</div>
                <ul className="list-disc pl-5 text-sm">
                  {questionQ.data.constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {questionQ.data?.solutionOutline && (
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSolution(!showSolution)}
                >
                  {showSolution ? "Hide Solution" : "Show Solution"}
                </Button>

                {showSolution && (
                  <div className="mt-3 whitespace-pre-wrap border-t pt-2 text-sm">
                    {questionQ.data.solutionOutline}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Code Editor */}
        <div className="flex-1">
          <div
            ref={containerRef}
            className="h-[70vh] rounded-md border border-neutral-800"
            id="editor"
          />
        </div>
      </div>

      {status && authRequired && (
        <div className="mt-2 flex items-center justify-between text-xs text-neutral-600">
          <div id="status">{status}</div>
          {authRequired && (
            <div className="mb-3 rounded-lg border border-red-400 bg-red-50 p-3 text-red-700">
              You’re not logged in. Please sign in, then refresh this page.
            </div>
          )}
        </div>
      )}

      {(ein || eout) && (
        <div className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="text-2xl font-semibold">
                Example Input / Output
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-1 font-semibold">Input</h3>
                <pre className="bg-muted overflow-x-auto whitespace-pre-wrap rounded-lg p-3 text-sm">
                  {ein}
                </pre>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Output</h3>
                <pre className="bg-muted overflow-x-auto whitespace-pre-wrap rounded-lg p-3 text-sm">
                  {eout}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
