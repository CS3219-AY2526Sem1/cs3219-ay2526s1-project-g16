import { MultiMatchMeSelect } from "@/components/matchMeSelect";
import { Button } from "@/components/ui/button";
import { MATCH_SERVICE_URL, QN_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import {
  questionDifficulties,
  type ListLanguagesResponse,
  type ListQuestionsResponse,
  type ListTopicsResponse,
  type MatchResponse,
  type MatchResult,
} from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

function Home() {
  const [questionTopics, setQuestionTopics] = useState<string[]>([""]);
  const [difficultyLevels, setDifficultyLevels] = useState<string[]>([""]);
  const [languages, setLanguages] = useState<string[]>([""]);
  const [subscribeUrl, setSubscribeUrl] = useState<string | null>(null);
  const [questionSearch, setQuestionSearch] = useState("");

  const { auth } = Route.useRouteContext();
  const { user } = auth;

  const topicsQuery = useQuery<ListTopicsResponse>({
    queryKey: ["questionTopics"],
    queryFn: async () => {
      const res = await authFetch(`${QN_SERVICE_URL}/topics`);
      if (!res.ok) {
        throw new Error("Topics response was not ok");
      }
      return res.json();
    },
  });

  const langsQuery = useQuery<ListLanguagesResponse>({
    queryKey: ["languages"],
    queryFn: async () => {
      const res = await authFetch(`${QN_SERVICE_URL}/languages`);
      if (!res.ok) {
        throw new Error("Languages response was not ok");
      }
      return res.json();
    },
  });

  const questionsQuery = useQuery<ListQuestionsResponse>({
    queryKey: ["questions"],
    queryFn: async () => {
      const res = await authFetch(`${QN_SERVICE_URL}/questions`);
      if (!res.ok) {
        throw new Error("Questions response was not ok");
      }
      return res.json();
    },
  });

  const findMatchMutation = useMutation({
    mutationFn: async (): Promise<MatchResponse> => {
      const res = await authFetch(`${MATCH_SERVICE_URL}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
          topicIn: questionTopics.filter((x) => !!x),
          difficultyIn: difficultyLevels.filter((x) => !!x),
          languageIn: languages.filter((x) => !!x),
        }),
      });
      if (!res.ok) {
        throw new Error("Match response was not ok");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setSubscribeUrl(data.subscribeUrl);
    },
  });

  const cancelMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`${MATCH_SERVICE_URL}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id,
        }),
      });
      if (!res.ok) {
        throw new Error("Cancel match response was not ok");
      }
      return res.json();
    },
    onSuccess: () => {
      setSubscribeUrl(null);
    },
  });

  useEffect(() => {
    let eventSource: EventSource;
    if (subscribeUrl) {
      eventSource = new EventSource(subscribeUrl);
      eventSource.addEventListener("TIMEOUT", () => {
        toast.error("Matching has timed out! Please try again.");
        setSubscribeUrl(null);
      });
      eventSource.addEventListener("MATCH_FOUND", (event) => {
        const { roomId }: Extract<MatchResult, { status: "MATCH_FOUND" }> =
          JSON.parse(event.data);
        setSubscribeUrl(null);
        console.log("Matched! Room ID:", roomId);
      });
    }
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [subscribeUrl]);

  // at most toast once
  const queryIsError = topicsQuery.isError || langsQuery.isError;
  if (queryIsError) {
    toast.error("Failed to load data. Please try again later.", {
      id: "data-load-error",
    });
  }

  const resolveTopicsForQuestion = (q: any) => {
    const allTopics = topicsQuery.data?.topics ?? [];

    if (!q?.topics) return "-";

    if (Array.isArray(q.topics) && typeof q.topics[0] === "string") {
      return q.topics.join(", ");
    }

    if (Array.isArray(q.topics)) {
      const names = q.topics
        .map((t: any) => {
          if (t?.name) return t.name;
          if (t?.topic?.name) return t.topic.name;
          if (t?.topicId) {
            const match = allTopics.find(
              (at) => at.id === t.topicId || at.name === t.topicId,
            );
            return match?.name ?? null;
          }
          return null;
        })
        .filter(Boolean);
      return names.length ? names.join(", ") : "-";
    }

    return "-";
  };

  const filteredQuestions = useMemo(() => {
    const search = questionSearch.trim().toLowerCase();
    if (!search) {
      return questionsQuery.data?.items ?? [];
    }

    return (
      questionsQuery.data?.items?.filter((q) => {
        const title = q.title?.toLowerCase?.() ?? "";
        const difficulty =
          ("difficulty" in q && q.difficulty
            ? q.difficulty
            : ""
          )?.toLowerCase?.() ?? "";
        const topics = resolveTopicsForQuestion(q).toLowerCase();

        return (
          title.includes(search) ||
          difficulty.includes(search) ||
          topics.includes(search)
        );
      }) ?? []
    );
  }, [questionSearch, questionsQuery.data, resolveTopicsForQuestion]);

  return (
    <main className="mt-24 flex w-full flex-col items-center justify-center gap-8">
      {subscribeUrl ? (
        <h1 className="after:animate-ellipsis flex text-7xl font-semibold text-pink-800/70 after:block after:w-0">
          Searching
        </h1>
      ) : (
        <h1 className="text-7xl font-semibold">Match Me</h1>
      )}
      {topicsQuery.isPending || langsQuery.isPending ? (
        <div className="mt-6 flex items-center gap-4 text-2xl text-neutral-700">
          <Loader2 className="animate-spin" />
          Loading...
        </div>
      ) : (
        <>
          <div className="mr-4 grid grid-cols-2 gap-x-2 gap-y-2 text-3xl">
            <span className="text-right">I want to do</span>
            <MultiMatchMeSelect
              placeholder="Question Topics"
              choices={
                topicsQuery.data?.topics?.map(({ name }) => ({
                  value: name,
                  label: name,
                })) ?? []
              }
              triggerClassName="text-blue-500"
              itemClassName="text-blue-900/80 focus:text-blue-500 data-[state=checked]:text-blue-500 [&_svg]:!text-blue-800/50"
              items={questionTopics}
              setItems={setQuestionTopics}
              disabled={queryIsError || !!subscribeUrl}
            />

            <span className="text-right">at difficulty level</span>
            <MultiMatchMeSelect
              placeholder="Difficulty Level"
              choices={questionDifficulties.map((level) => ({
                value: level,
                label: level,
              }))}
              triggerClassName="text-orange-500"
              itemClassName="text-orange-900/80 focus:text-orange-500 data-[state=checked]:text-orange-500 [&_svg]:!text-orange-800/50"
              items={difficultyLevels}
              setItems={setDifficultyLevels}
              disabled={queryIsError || !!subscribeUrl}
            />

            <span className="text-right">using</span>
            <MultiMatchMeSelect
              placeholder="Language"
              choices={
                langsQuery.data?.languages?.map(({ name }) => ({
                  value: name,
                  label: name,
                })) ?? []
              }
              triggerClassName="text-red-500"
              itemClassName="text-red-900/80 focus:text-red-500 data-[state=checked]:text-red-500 [&_svg]:!text-red-800/50"
              items={languages}
              setItems={setLanguages}
              disabled={queryIsError || !!subscribeUrl}
            />
          </div>

          {subscribeUrl ? (
            <Button
              size="lg"
              className="bg-red-500 hover:bg-red-600"
              onClick={() => cancelMatchMutation.mutate()}
            >
              Cancel Matching
            </Button>
          ) : (
            <Button
              size="lg"
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => findMatchMutation.mutate()}
              disabled={
                questionTopics.filter((x) => !!x).length === 0 ||
                difficultyLevels.filter((x) => !!x).length === 0 ||
                languages.filter((x) => !!x).length === 0 ||
                findMatchMutation.isPending ||
                queryIsError
              }
            >
              {findMatchMutation.isPending && (
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              )}
              Match Me!
            </Button>
          )}
          <div className="mb-24 mt-10 w-full max-w-5xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-left text-2xl font-semibold">Questions</h2>
              <input
                value={questionSearch}
                onChange={(e) => setQuestionSearch(e.target.value)}
                placeholder="Search questions..."
                className="w-56 rounded-md border border-neutral-200 px-3 py-1.5 text-sm focus:border-neutral-400 focus:outline-none"
              />
            </div>
            {questionsQuery.isPending ? (
              <div className="flex items-center gap-2 text-neutral-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading questions...
              </div>
            ) : questionsQuery.isError ? (
              <div className="text-sm text-red-500">
                Failed to load questions.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-4 py-2 font-medium text-neutral-700">
                        Name
                      </th>
                      <th className="px-4 py-2 font-medium text-neutral-700">
                        Difficulty
                      </th>
                      <th className="px-4 py-2 font-medium text-neutral-700">
                        Topics
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.map((q) => (
                      <tr key={q.id ?? q.title} className="border-t">
                        <td className="px-4 py-2">{q.title}</td>
                        <td className="px-4 py-2">
                          {"difficulty" in q && q.difficulty
                            ? q.difficulty
                            : "-"}
                        </td>
                        <td className="px-4 py-2">
                          {resolveTopicsForQuestion(q)}
                        </td>
                      </tr>
                    ))}
                    {filteredQuestions.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-4 text-center text-neutral-400"
                        >
                          No questions match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
