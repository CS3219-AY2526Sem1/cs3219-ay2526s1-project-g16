import { MultiMatchMeSelect } from "@/components/matchMeSelect";
import { QN_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import {
  questionDifficulties,
  type ListLanguagesResponse,
  type ListTopicsResponse,
} from "@/types";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

function Home() {
  const [questionTopics, setQuestionTopics] = useState<string[]>([""]);
  const [difficultyLevels, setDifficultyLevels] = useState<string[]>([""]);
  const [languages, setLanguages] = useState<string[]>([""]);

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

  // at most toast once
  const queryIsError = topicsQuery.isError || langsQuery.isError;
  if (queryIsError) {
    toast.error("Failed to load data. Please try again later.", {
      id: "data-load-error",
    });
  }

  return (
    <main className="mt-24 flex w-full flex-col items-center justify-center gap-8">
      <h1 className="text-7xl font-semibold">Match Me</h1>
      {topicsQuery.isPending || langsQuery.isPending ? (
        <div className="mt-6 flex items-center gap-4 text-2xl text-neutral-700">
          <Loader2 className="animate-spin" />
          Loading...
        </div>
      ) : (
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
            disabled={queryIsError}
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
            disabled={queryIsError}
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
            disabled={queryIsError}
          />
        </div>
      )}
    </main>
  );
}
