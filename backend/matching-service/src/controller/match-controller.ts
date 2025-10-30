import type { Request, Response } from "express";
import { z } from "zod";
import { enqueueOrMatch, getStatus, cancel } from "../model/match-model.ts";

const strOrArray = z.union([z.string().min(1), z.array(z.string().min(1))]).optional();
const COLLAB_BASE = process.env.COLLAB_SERVICE_URL ?? "http://collab:3009";

export const ticketSchema = z.object({
  userId: z.string().min(1),
  languageIn: strOrArray,
  difficultyIn: strOrArray,
  topicIn: strOrArray,
  ttlMs: z.number().int().positive().max(10 * 60 * 1000).optional(),
});

type TicketInput = z.infer<typeof ticketSchema>;

export async function requestMatch(req: Request, res: Response) {
  try {
    await checkIfUserInMatch(req, res);
    console.log("User not in match!")
    const body: TicketInput = ticketSchema.parse(req.body);
    const result = await enqueueOrMatch(body);

    const base = `${req.protocol}://${req.get("host")}`;
    const subscribeUrl = `${base}/match/subscribe/${encodeURIComponent(body.userId)}`;

    if (result?.status === "matched") {
      const session = await createUserMatch(req, res, result);
      return res.status(200).json({ ...result, session, subscribeUrl });
    }

    return res.status(202).json({ ...result, subscribeUrl });
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({ error: "Invalid payload", details: err.issues });
    }
    if (err?.code === "ALREADY_IN_ACTIVE_SESSION") {
      return res.status(409).json({ error: "User already in an active session", session: err.session ?? null });
    }
    return res.status(500).json({ error: "Internal error" });
  }
}

function writeSSE(res: Response, event: string, data: any, id?: string) {
  if (id) res.write(`id: ${id}\n`);
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function subscribeMatchSSE(req: Request, res: Response) {
  const parseUserId = z.string().min(1).safeParse(req.params.userId);
  if (!parseUserId.success) {
    res.status(400).end("Invalid userId");
    return;
  }
  const userId = parseUserId.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  res.write(": connected\n\n");

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(`event: heartbeat\ndata: {}\n\n`);
  }, 15_000);

  const SSE_WINDOW_MS = 30_000;
  let lastSig = "";
  let startedAt = new Date();
  let ended = false;

  const safeCleanup = () => {
    if (ended) return;
    ended = true;
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  };

  try {
    const initial = await getStatus(userId);
    if ((initial as any)?.startedTime) startedAt = new Date((initial as any).startedTime as any);
    writeSSE(res, "status", initial ?? { status: "not_found" });
    lastSig = JSON.stringify(initial ?? {});
  } catch {
    // ignore; poll will try again
  }

  async function poll() {
    if (ended || res.writableEnded) return;

    try {
      const status = await getStatus(userId);
      const sig = JSON.stringify(status ?? {});
      if (sig !== lastSig) {
        lastSig = sig;
        writeSSE(res, "status", status ?? { status: "not_found" });
      }

      const st = (status as any)?.startedTime;
      if (st && !Number.isNaN(Date.parse(st))) startedAt = new Date(st);

      const s = status?.status;

      if (s === "matched" || s === "cancelled" || s === "not_found") {
        writeSSE(res, s ?? "not_found", status ?? {});
        return safeCleanup();
      }

      if (Date.now() - +startedAt > SSE_WINDOW_MS) {
        writeSSE(res, "timeout", { message: "No match found", startedTime: startedAt });
        return safeCleanup();
      }

    } catch {
      writeSSE(res, "error", { message: "poll failed" });
      // keep polling; do not end
    }

    if (!ended && !res.writableEnded) setTimeout(poll, 1_000);
  }

  poll();
  req.on("close", safeCleanup);
}

export async function getMatchStatus(req: Request, res: Response) {
  try {
    const userId = z.string().min(1).parse(req.params.userId);
    const result = await getStatus(userId);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: "Invalid userId" });
    return res.status(500).json({ error: "Internal error" });
  }
}

export async function cancelMatch(req: Request, res: Response) {
  try {
    const userId = z.string().min(1).parse(req.body.userId);
    const result = await cancel(userId);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: "Invalid userId" });
    return res.status(500).json({ error: "Internal error" });
  }
}

type CollabSession = {
  id: string;
  topic: string;
  difficulty: string;
  questionId: string | null;
  status: "ACTIVE" | "ENDED" | string;
  expiresAt: string | null;
  participants?: Array<{ userId: string }>;
};

type EnqueueResult =
  | { status: "queued"; position: number }
  | {
      status: "matched";
      roomId?: string;
      topic?: string;
      difficulty?: string;
      questionId?: string | null;
    };

export async function checkIfUserInMatch(req: Request, _res: Response): Promise<void> {
  const userId = req.body?.userId ?? req.query?.userId;
  if (!userId || typeof userId !== "string") return;

  const url = `${COLLAB_BASE}/sessions/active?userId=${encodeURIComponent(userId)}`;

  try {
    const active = await httpJSON<CollabSession | null>(url, { method: "GET" });
    if (active && active.status === "ACTIVE") {
      const e: any = new Error("User already in active session");
      e.code = "ALREADY_IN_ACTIVE_SESSION";
      e.session = active;
      throw e;
    }
  } catch (e: any) {
    if (!/HTTP 404/.test(e?.message ?? "")) {
      console.warn(`[checkIfUserInMatch] Upstream check failed: ${e?.message}`);
    }
  }
}

export async function createUserMatch(
  req: Request,
  _res: Response,
  match: Extract<EnqueueResult, { status: "matched" }>
): Promise<CollabSession> {
  const body: TicketInput = req.body;

  const roomId = match.roomId ?? randomUUID();
  const topic = match.topic ?? body.topic;
  const difficulty = match.difficulty ?? body.difficulty;
  const questionId = match.questionId ?? body.questionId ?? null;

  const url = `${COLLAB_BASE}/sessions`;

  const payload = {
    id: roomId,
    topic,
    difficulty,
    questionId,
  };

  const session = await httpJSON<CollabSession>(url, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return session;
}

async function httpJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text}`);
  }

  return res.json() as Promise<T>;
}