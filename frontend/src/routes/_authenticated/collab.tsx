// src/routes/_authenticated/collab.tsx
import { CodeEditor } from "@/components/codeEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ATTEMPT_SERVICE_URL,
  CODERUNNER_URL,
  COLLAB_SERVICE_URL,
} from "@/constants";
import { ensureMonacoLanguage } from "@/lib/loadMonacoLang";
import { setupMonacoEnvironment } from "@/lib/monacoWorkers";
import { authFetch } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import type { editor } from "monaco-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const HTTP_BASE = COLLAB_SERVICE_URL; // HTTP control plane
const WS_BASE = `${COLLAB_SERVICE_URL.replace(/^http\b/, "ws")}/ws`; // WS data plane

// === TYPES ===
type CollabSession = {
  id: string;
  topic: string | null;
  difficulty: string | null;
  questionId: string | null;
  status: "ACTIVE" | "ENDED" | string;
  expiresAt: string | null;
  language?: "java" | "python";
  participants?: Array<{ userId: string }>;
};

// === HELPERS ===
function normParam(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function toMonacoLanguageId(lang?: "java" | "python"): "java" | "python" {
  return lang === "java" ? "java" : "python";
}

export const Route = createFileRoute("/_authenticated/collab")({
  component: CollaborationSpace,
  validateSearch: (search) => {
    return { roomId: normParam(search.roomId) };
  },
});

// === MAIN COLLAB SPACE LOGIC ===
function CollaborationSpace() {
  const router = useRouter();
  const search = Route.useSearch();
  const { auth } = Route.useRouteContext();
  const { user } = auth;

  const urlRoomId = search.roomId ?? "";

  const containerRef = useRef<HTMLDivElement | null>(null); // editor DOM
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null); // Monaco editor instance
  const modelRef = useRef<editor.ITextModel>(null); // Monaco model
  const providerRef = useRef<any>(null); // Hocuspocus (Yjs) provider

  const [status, setStatus] = useState("status: initializing…");
  const [readOnly, setReadOnly] = useState(false);
  const [endedBanner, setEndedBanner] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [participants, setParticipants] = useState<{ userId: string }[]>([]);
  const [runOut, setRunOut] = useState<string>("");
  const [runErr, setRunErr] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);

  // === RETRIEVAL FROM COLLAB/QNS ===
  const sessionQ = useQuery({
    queryKey: ["collab-session-active"],
    queryFn: async (): Promise<CollabSession | null> => {
      try {
        const res = await authFetch(`${HTTP_BASE}/sessions/active`, {
          method: "GET",
        });
        if (res.status === 401) {
          setAuthRequired(true);
          return null;
        }
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

  // Choose roomId from SSE or from sessionQ (check for active session)
  const roomId = useMemo(
    () => urlRoomId || sessionQ.data?.id || "",
    [urlRoomId, sessionQ.data?.id],
  );

  // Retrieve question
  const sessionByIdQ = useQuery({
    queryKey: ["collab-session", roomId],
    enabled: !!roomId,
    queryFn: async (): Promise<CollabSession | null> => {
      const res = await authFetch(
        `${HTTP_BASE}/sessions/${encodeURIComponent(roomId)}`,
        { method: "GET" },
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch session");
      const { data } = await res.json();
      return (data ?? null) as CollabSession | null;
    },
    staleTime: 15_000,
  });

  const qid = sessionByIdQ.data?.questionId || "";

  const sessionLang =
    (sessionByIdQ.data?.language as "java" | "python") ?? "python";
  const monacoLang = toMonacoLanguageId(sessionLang);

  const saveProgressMutation = useMutation({
    mutationFn: async () => {
      const content = modelRef.current?.getValue();
      const userId = user?.id;
      const collabId = participants.find((p) => p.userId !== userId)?.userId;
      const questionId = Number(qid);

      if (!content) {
        throw new Error("No code to save!");
      }

      if (!roomId || !userId || !questionId) {
        throw new Error("Missing data to save progress.");
      }

      const res = await authFetch(`${ATTEMPT_SERVICE_URL}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collabId, questionId, content }),
      });

      if (!res.ok) {
        toast.error("Failed to save progress.");
        throw new Error("Failed to save progress.");
      }
    },
    onSuccess: () => {
      toast.success("Progress saved successfully.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // === TO END SESSION ===
  async function endNow() {
    if (!roomId || isEnding) return;
    const ok = window.confirm("End this session for everyone?");
    if (!ok) return;

    setIsEnding(true);
    try {
      const res = await authFetch(
        `${HTTP_BASE}/sessions/${encodeURIComponent(roomId)}/end`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`End failed: ${res.status} ${msg}`);
      }

      // client-side shutdown (the poller will also catch it)
      setEndedBanner("This session has ended. Editing is disabled.");
      setReadOnly(true);
      try {
        providerRef.current?.destroy?.();
      } catch {}
      try {
        editorRef.current?.updateOptions?.({ readOnly: true });
      } catch {}
    } catch (e) {
      alert((e as Error).message || "Failed to end session.");
    } finally {
      setIsEnding(false);
    }
  }

  // === TO RUN CODE ===
  async function runCodeNow() {
    if (!roomId) return;
    const code = modelRef.current?.getValue() ?? "";
    if (!code.trim()) {
      toast.info("Nothing to run yet.");
      return;
    }

    setIsRunning(true);
    setRunErr("");
    setRunOut("");

    try {
      const res = await authFetch(`${CODERUNNER_URL.replace(/\/+$/, "")}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: sessionLang, code }),
      });

      const json = await res.json().catch(() => ({}) as any);
      if (!res.ok) {
        const msg = json?.error || `Run failed (${res.status})`;
        setRunErr(String(msg));
        toast.error("Run failed.");
        return;
      }

      const {
        stdout = "",
        stderr = "",
        exitCode = null,
      } = json as {
        stdout?: string;
        stderr?: string;
        exitCode?: number | null;
      };

      const banner = exitCode === 0 ? "" : `(exitCode=${exitCode ?? "?"})`;
      const combined = [
        stdout,
        stderr && `\n[stderr]\n${stderr}`,
        banner && `\n${banner}`,
      ]
        .filter(Boolean)
        .join("");

      setRunOut(combined || "(no output)");
      toast.success("Run complete.");
    } catch (e: any) {
      setRunErr(e?.message || "Run failed.");
      toast.error("Run failed.");
    } finally {
      setIsRunning(false);
    }
  }

  useEffect(() => {
    if (!roomId) return;
    if (authRequired) {
      setStatus("Not logged in");
      return;
    }
    if (sessionByIdQ.isLoading) return; // wait to know the language

    let disposed = false;
    let cleanup = () => {};

    (async () => {
      setupMonacoEnvironment();

      // Make sure the language is registered before creating the model/editor
      await ensureMonacoLanguage(monacoLang);

      const [{ HocuspocusProvider }, Y, { MonacoBinding }, monaco] =
        await Promise.all([
          import("@hocuspocus/provider"),
          import("yjs"),
          import("y-monaco"),
          import("monaco-editor"),
        ]);
      if (disposed) return;

      // 1) connect Yjs provider (through WS auth/proxy)
      const wsUrl = `${WS_BASE}/${encodeURIComponent(roomId)}`;
      const provider = new HocuspocusProvider({ url: wsUrl, name: roomId });
      providerRef.current = provider;

      // 2) prepare Yjs document + text
      const ydoc = provider.document as InstanceType<typeof Y.Doc>;
      const ytext = ydoc.getText("code");
      ydoc.getMap("meta");

      provider.on("status", (e: any) =>
        setStatus(`status: ${e.status} to room ${roomId}`),
      );
      provider.on("close", () =>
        setStatus(`status: closed (upgrade failed or server closed)`),
      );

      // 3) Monaco model
      const model = monaco.editor.createModel(ytext.toString(), monacoLang);
      model.setEOL(monaco.editor.EndOfLineSequence.LF); // normalise EOL
      modelRef.current = model;

      // 4) Monaco editor
      const editor = monaco.editor.create(containerRef.current!, {
        model,
        language: monacoLang,
        theme: "vs-dark",
        automaticLayout: true,
        minimap: { enabled: false },
        tabSize: 4,
        insertSpaces: true,
        readOnly,
        wordWrap: "off",
      });
      editorRef.current = editor;

      // 5) bind Yjs <-> Monaco
      new MonacoBinding(ytext, model, new Set([editor]), provider.awareness);

      // 6) poll session liveness; if not ACTIVE → make editor readOnly
      const poller = setInterval(async () => {
        try {
          const resp = await authFetch(
            `${HTTP_BASE}/sessions/${encodeURIComponent(roomId)}`,
            { method: "GET" },
          );
          if (!resp.ok) return; 

          const { data } = (await resp.json()) as {
            data: CollabSession | null;
          };
          if (data && data.status === "ACTIVE") {
            return setParticipants(data.participants ?? []);
          }

          setStatus(`session ended (${data?.status ?? "unknown"})`);
          setEndedBanner("This session has ended. Editing is disabled.");
          saveProgressMutation.mutate();
          try {
            provider.destroy();
          } catch {}
          setReadOnly(true);
          try {
            editor.updateOptions({ readOnly: true });
          } catch {}
          clearInterval(poller);
        } catch {}
      }, 2000);

      // cleanup on unmount/navigation/refresh
      cleanup = () => {
        clearInterval(poller);
        try {
          provider.destroy();
        } catch {}
        try {
          editor.dispose();
        } catch {}
        try {
          model.dispose();
        } catch {}
        providerRef.current = null;
        editorRef.current = null;
        modelRef.current = null;
      };
    })();

    // cleanup outside the async iife and in useeffect
    return () => {
      disposed = true;
      cleanup();
    };
  }, [roomId, sessionByIdQ.isLoading, monacoLang]);

  useEffect(() => {
    if (editorRef.current) {
      try {
        editorRef.current.updateOptions({ readOnly });
      } catch {}
    }
  }, [readOnly]);

  const showNoSession = sessionQ.isSuccess && !sessionQ.data && !roomId;

  return (
    <main className="mt-4 w-full px-3 pb-8 md:px-4">
      {showNoSession && (
        <>
          <div className="rounded-lg border border-yellow-400 bg-yellow-50 p-4 text-yellow-800">
            No active session found. Return to the main page to start a new
            session.
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => router.navigate({ to: "/" })}
            >
              Back to Home
            </Button>
          </div>
        </>
      )}

      {endedBanner && (
        <div className="mb-2 rounded-md border border-neutral-600 bg-neutral-900/40 p-2 text-xs text-pink-200">
          {endedBanner}
        </div>
      )}

      <CodeEditor
        sessionLang={sessionByIdQ.isLoading ? "…" : `Language: ${sessionLang}`}
        qid={qid}
        actionButtons={
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={!roomId || isEnding}
              onClick={() => saveProgressMutation.mutate()}
            >
              Save Progress
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={endNow}
              disabled={!roomId || isEnding}
            >
              {isEnding ? "Ending…" : "End Session"}
            </Button>

            <Button
              variant="default"
              size="sm"
              disabled={!roomId || isRunning}
              onClick={runCodeNow}
            >
              {isRunning ? "Running…" : "Run Code"}
            </Button>
          </>
        }
        containerRef={containerRef}
        status={status}
        authRequired={authRequired}
      />

      <div className="mt-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="text-2xl font-semibold">Runtime Output</div>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted overflow-x-auto whitespace-pre-wrap rounded-lg p-3 text-sm">
              {runErr ? runErr : runOut || "— No output yet —"}
            </pre>

            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRunOut("");
                  setRunErr("");
                }}
                disabled={!runOut && !runErr}
              >
                Clear Output
              </Button>
              <Button
                size="sm"
                onClick={runCodeNow}
                disabled={!roomId || isRunning}
              >
                {isRunning ? "Running…" : "Run Again"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}