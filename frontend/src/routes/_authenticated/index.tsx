import { MatchMeSelect, MultiMatchMeSelect } from "@/components/matchMeSelect";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/")({
  component: Home,
});

function Home() {
  const [questionTypes, setQuestionTypes] = useState<string[]>([""]);
  const [difficultyLevel, setDifficultyLevel] = useState<string>("");
  const [languages, setLanguages] = useState<string[]>([""]);

  return (
    <main className="w-full flex flex-col items-center justify-center mt-24 gap-8">
      <h1 className="text-7xl font-semibold">Match Me</h1>
      <div className="grid grid-cols-2 text-3xl gap-x-2 gap-y-2 mr-4">
        <span className="text-right">I want to do</span>
        <MultiMatchMeSelect
          placeholder="Question Type"
          choices={[
            { value: "test1", label: "Test 1" },
            { value: "test2", label: "Test 2" },
            { value: "test3", label: "Test 3" },
          ]}
          triggerClassName="text-blue-500"
          itemClassName="text-blue-900/80 focus:text-blue-500 data-[state=checked]:text-blue-500 [&_svg]:!text-blue-800/50"
          items={questionTypes}
          setItems={setQuestionTypes}
        />

        <span className="text-right">at difficulty level</span>
        <MatchMeSelect
          placeholder="Difficulty Level"
          choices={[
            { value: "test1", label: "Test 1" },
            { value: "test2", label: "Test 2" },
            { value: "test3", label: "Test 3" },
          ]}
          triggerClassName="text-orange-500"
          itemClassName="text-orange-900/80 focus:text-orange-500 data-[state=checked]:text-orange-500 [&_svg]:!text-orange-800/50"
          item={difficultyLevel}
          setItem={setDifficultyLevel}
        />

        <span className="text-right">using</span>
        <MultiMatchMeSelect
          placeholder="Language"
          choices={[
            { value: "test1", label: "Test 1" },
            { value: "test2", label: "Test 2" },
            { value: "test3", label: "Test 3" },
          ]}
          triggerClassName="text-red-500"
          itemClassName="text-red-900/80 focus:text-red-500 data-[state=checked]:text-red-500 [&_svg]:!text-red-800/50"
          items={languages}
          setItems={setLanguages}
        />
      </div>
    </main>
  );
}
