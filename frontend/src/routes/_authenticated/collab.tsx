// src/routes/_authenticated/collab.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { authFetch } from "@/lib/utils";
import { QN_SERVICE_URL } from "@/constants";
import { setupMonacoEnvironment } from "@/lib/monacoWorkers";

const WS_BASE = import.meta.env.VITE_COLLAB_WS_URL ?? "ws://localhost:3009/collab/ws";
const HTTP_BASE = import.meta.env.VITE_COLLAB_HTTP_URL ?? "http://localhost:3009/collab";

type CollabSession = {
  id: string;
  topic: string | null;
  difficulty: string | null;
  questionId: string | null;
  status: "ACTIVE" | "ENDED" | string;
  expiresAt: string | null;
  participants?: Array<{ userId: string }>;
};

type QuestionExample = { input: string; output: string };
type Question = {
  id: number;
  title: string;
  statement: string;
  difficulty: string;
  constraints?: string[];
  solutionOutline?: string;
  exampleIO?: QuestionExample[];
  metadata?: Record<string, unknown>;
  topics?: { questionId: number; topicId: number; topic: { id: number; name: string } }[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

function normParam(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

export const Route = createFileRoute("/_authenticated/collab")({
  component: CollaborationSpace,
  validateSearch: (s: Record<string, unknown>) => {
    const qidRaw = (s as any).qid ?? (s as any).qId;
    return {
      roomId: normParam(s.roomId),
      lang: normParam(s.lang),
      qid: normParam(qidRaw),
      token: normParam((s as any).token),     
      qtitle: normParam((s as any).qtitle),   
      q: normParam((s as any).q),             
    };
  },
});

function CollaborationSpace() {
  const router = useRouter();
  const search = Route.useSearch();

  const qidToUse = search.qid ?? "";
  const urlRoomId = search.roomId ?? "";
  const token = search.token ?? "";
  const lang = (search.lang ?? "javascript") as string;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const providerRef = useRef<any>(null);

  const [status, setStatus] = useState("status: initializing…");
  const [readOnly, setReadOnly] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [endedBanner, setEndedBanner] = useState<string | null>(null);

  const missingToken = !token;

  const sessionQ = useQuery({
    queryKey: ["collab-session-active"],
    queryFn: async (): Promise<CollabSession | null> => {
      try {
        const res = await authFetch(`${HTTP_BASE}/sessions/active`, { method: "GET" });
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to fetch active session");
        const { data } = await res.json();
        return (data ?? null) as CollabSession | null;
      } catch {
        return null;
      }
    },
    staleTime: 15_000,
    refetchOnWindowFocus: "always",
  });

  const roomId = useMemo(
    () => urlRoomId || sessionQ.data?.id || "",
    [urlRoomId, sessionQ.data?.id]
  );

  const QN_BASE = (QN_SERVICE_URL && QN_SERVICE_URL.trim()) || "http://localhost:3001";
  const effectiveBase = QN_BASE.replace(/\/+$/, "");

  const questionQ = useQuery({
    queryKey: ["collab-question", qidToUse, effectiveBase],
    enabled: !!qidToUse,
    retry: 0,
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<Question> => {
      const res = await fetch(`${effectiveBase}/questions/${encodeURIComponent(qidToUse)}`, {
        headers: { Accept: "application/json" },
        mode: "cors",
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Question fetch failed: ${res.status} ${text}`);
      }
      const data = await res.json();
      return data;
    },
  });

  useEffect(() => {
    if (!roomId) return;
    if (missingToken) { setStatus("Missing ?token"); return; }

    let disposed = false;

    (async () => {
      setupMonacoEnvironment();

      const [{ HocuspocusProvider }, Y, { MonacoBinding }, monaco] = await Promise.all([
        import("@hocuspocus/provider"),
        import("yjs"),
        import("y-monaco"),
        import("monaco-editor"),
      ]);
      if (disposed) return;

      const wsUrl = `${WS_BASE}/${encodeURIComponent(roomId)}?token=${encodeURIComponent(token)}`;
      const provider = new HocuspocusProvider({ url: wsUrl, name: roomId });
      providerRef.current = provider;

      const ydoc = provider.document as InstanceType<typeof Y.Doc>;
      const ytext = ydoc.getText("code");
      ydoc.getMap("meta");

      provider.on("status", (e: any) => setStatus(`status: ${e.status} to room ${roomId}`));

      const initial = getTemplateFor((lang as keyof typeof templates) || "javascript");
      if (ytext.length === 0) ytext.insert(0, initial);

      const model = monaco.editor.createModel(ytext.toString(), lang || "javascript");
      modelRef.current = model;

      const editor = monaco.editor.create(containerRef.current!, {
        model,
        language: lang || "javascript",
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        tabSize: 2,
        insertSpaces: true,
        readOnly,
      });
      editorRef.current = editor;

      new MonacoBinding(ytext, model, new Set([editor]), provider.awareness);

      const poller = setInterval(async () => {
        try {
          const resp = await fetch(`${HTTP_BASE}/sessions/${encodeURIComponent(roomId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!resp.ok) return; // ignore transient errors
          const { data } = (await resp.json()) as { data: CollabSession | null };
          if (!data || data.status !== "ACTIVE") {
            setStatus(`session ended (${data?.status ?? "unknown"})`);
            setEndedBanner("This session has ended. Editing is disabled.");
            try { provider.destroy(); } catch {}
            setReadOnly(true);
            try { editor.updateOptions({ readOnly: true }); } catch {}
            clearInterval(poller);
          }
        } catch {
        }
      }, 2000);

      const cleanup = () => {
        clearInterval(poller);
        try { provider.destroy(); } catch {}
        try { editor.dispose(); } catch {}
        try { model.dispose(); } catch {}
      };

      window.addEventListener("beforeunload", cleanup);
      return () => {
        window.removeEventListener("beforeunload", cleanup);
        cleanup();
      };
    })();

    return () => { disposed = true; };
  }, [roomId, lang, readOnly, token, missingToken]);

  const title =
    search.qtitle ??
    questionQ.data?.title ??
    (questionQ.isLoading ? "Loading question…" : qidToUse ? "Question unavailable" : "Unavailable Room.");

  const statement =
    (search.q ?? undefined) ??
    questionQ.data?.statement ??
    (questionQ.isError
      ? "Failed to load question."
      : qidToUse
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


  const showNoSession = sessionQ.isSuccess && !sessionQ.data && !roomId;

  return (
    <main className="mt-4 w-full px-3 md:px-4 pb-8">
      {showNoSession && (
        <>
          <div className="rounded-lg border border-yellow-400 bg-yellow-50 p-4 text-yellow-800">
            No active session found. Return to the main page to start a new session.
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => router.navigate({ to: "/" })}>
              Back to Home
            </Button>
          </div>
        </>
      )}

      <div className="flex flex-col gap-3 lg:flex-row mt-3">
        {/* Question Card */}
        <Card className="lg:w-[38%] w-full h-[70vh] overflow-hidden">
          <CardHeader className="pb-2">
            {endedBanner && (
              <div className="mb-2 rounded-md border border-neutral-600 bg-neutral-900/40 p-2 text-xs text-pink-200">
                {endedBanner}
              </div>
            )}

            <div className="text-2xl font-semibold">{title}</div>

            {topicNames.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {topicNames.map((name) => (
                  <span
                    key={name}
                    className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {questionQ.data?.difficulty && (
              <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {questionQ.data.difficulty}
              </div>
            )}

            {questionQ.isLoading && qidToUse && (
              <div className="mt-2 text-xs text-muted-foreground">Loading…</div>
            )}
          </CardHeader>

          <CardContent className="h-full overflow-y-auto whitespace-pre-wrap">
            {questionQ.isError && (
              <div className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-800">
                {(questionQ.error as Error)?.message || "Failed to load question."}
              </div>
            )}

            {statement}

            {questionQ.data?.constraints?.length ? (
              <div className="mt-4">
                <div className="font-semibold mb-1">Constraints</div>
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
                  <div className="mt-3 text-sm whitespace-pre-wrap border-t pt-2">
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
            className="h-[70vh] border border-neutral-800 rounded-md"
            id="editor"
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-neutral-600">
        <div id="status">{status}</div>
        {missingToken && <div className="text-red-500">Token is required (?token=…)</div>}
      </div>

      {(ein || eout) && (
        <div className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="text-2xl font-semibold">Example Input / Output</div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-1 font-semibold">Input</h3>
                <pre className="rounded-lg bg-muted p-3 text-sm overflow-x-auto whitespace-pre-wrap">
                  {ein}
                </pre>
              </div>
              <div>
                <h3 className="mb-1 font-semibold">Output</h3>
                <pre className="rounded-lg bg-muted p-3 text-sm overflow-x-auto whitespace-pre-wrap">
                  {eout}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

const templates = {
  javascript: `// JS
function main(){ console.log('hello'); }`,
  typescript: `// TS
export function main(): void { console.log('hello'); }`,
  python: `# Python
def main():
    print("hello")`,
  cpp: `// C++
#include <bits/stdc++.h>
using namespace std;
int main(){ cout << "hello\\n"; }`,
  java: `// Java
class Main { public static void main(String[] args){ System.out.println("hello"); } }`,
} as const;

function getTemplateFor(lang: keyof typeof templates) {
  return templates[lang] ?? templates.javascript;
}
