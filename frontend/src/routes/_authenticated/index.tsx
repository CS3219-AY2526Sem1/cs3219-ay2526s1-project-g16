import { MultiMatchMeSelect } from "@/components/matchMeSelect";
import { Button } from "@/components/ui/button";
import { MATCH_SERVICE_URL, QN_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import {
  questionDifficulties,
  type ListLanguagesResponse,
  type ListTopicsResponse,
  type MatchResponse,
} from "@/types";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

function Home() {
  const [questionTopics, setQuestionTopics] = useState<string[]>([""]);
  const [difficultyLevels, setDifficultyLevels] = useState<string[]>([""]);
  const [languages, setLanguages] = useState<string[]>([""]);
  const [subscribeUrl, setSubscribeUrl] = useState<string | null>(null);

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
      eventSource.addEventListener("status", (event) => {
        const data: MatchResponse = JSON.parse(event.data);
        if (data.status === "not_found") {
          toast.error("Matching has timed out! Please try again.");
          setSubscribeUrl(null);
        }
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
        </>
      )}
    </main>
  );
}
