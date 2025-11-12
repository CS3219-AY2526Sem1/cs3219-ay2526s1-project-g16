import { CodeEditor } from "@/components/codeEditor";
import { ATTEMPT_SERVICE_URL } from "@/constants";
import { setupMonacoEnvironment } from "@/lib/monacoWorkers";
import { authFetch } from "@/lib/utils";
import type { ListAttemptsResponse } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { editor } from "monaco-editor";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_authenticated/attempt/$attemptId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { auth } = Route.useRouteContext();
  const { user } = auth;
  const { attemptId } = Route.useParams();

  const attemptsQuery = useQuery<ListAttemptsResponse[number]>({
    queryKey: ["attempts", attemptId],
    queryFn: async () => {
      const res = await authFetch(`${ATTEMPT_SERVICE_URL}/${user?.id}`);
      if (!res.ok) {
        throw new Error("Attempts response was not ok");
      }
      const attempts: ListAttemptsResponse = await res.json();
      const attempt = attempts.find((a) => a.id === attemptId);

      if (!attempt) {
        throw new Error("Attempt not found");
      }

      return attempt;
    },
    enabled: !!user?.id && !!attemptId,
  });

  const containerRef = useRef<HTMLDivElement | null>(null); // editor DOM
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null); // Monaco editor instance
  const modelRef = useRef<editor.ITextModel>(null); // Monaco model

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      setupMonacoEnvironment();

      const monaco = await import("monaco-editor");
      if (disposed) return;

      const model = monaco.editor.createModel(attemptsQuery.data?.code ?? "");
      model.setEOL(monaco.editor.EndOfLineSequence.LF); // normalise EOL
      modelRef.current = model;

      // 4) Monaco editor
      const editor = monaco.editor.create(containerRef.current!, {
        model,
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        tabSize: 4,
        insertSpaces: true,
        readOnly: true,
        wordWrap: "off",
      });
      editorRef.current = editor;

      // cleanup on unmount/navigation/refresh
      cleanup = () => {
        try {
          editor.dispose();
        } catch {}
        try {
          model.dispose();
        } catch {}
        // providerRef.current = null;
        editorRef.current = null;
        modelRef.current = null;
      };
    })();

    // cleanup outside the async iife and in useeffect
    return () => {
      disposed = true;
      cleanup();
    };
  }, [attemptsQuery.data]);
  console.log(attemptsQuery.data);

  return (
    <main className="mt-4 w-full px-3 pb-8 md:px-4">
      {attemptsQuery.isSuccess && (
        <CodeEditor
          qid={attemptsQuery.data.question.toString()}
          containerRef={containerRef}
        />
      )}
    </main>
  );
}
