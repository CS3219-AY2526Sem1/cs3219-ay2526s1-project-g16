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
    const subscribeUrl = `${base}/subscribe/${encodeURIComponent(body.userId)}`;

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
    return res.status(500).json({
      error: "Internal error",
      message: err.message || "Unknown error"
    });
  }
}

function writeSSE(res: Response, event: string, data: any, id?: string) {
  if (id) res.write(`id: ${id}\n`);
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
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
  const token = extractAccessToken(req);
  if (!token) {
    const e: any = new Error("User not authenticated");
    throw e;
  }

  const url = `${COLLAB_BASE}/sessions/active`;
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (resp.status === 401 || resp.status === 403 || resp.status === 404) {
    console.warn(`[checkIfUserInMatch] upstream ${resp.status} ${resp.statusText}`);
    const e: any = new Error("Not Expected Error Thrown");
    throw e;
  }

  const body = (await resp.json()) as { data: CollabSession | null };
  const active = body?.data ?? null;

  if (active && active.status === "ACTIVE") {
    const e: any = new Error("User already in active session");
    e.code = "ALREADY_IN_ACTIVE_SESSION";
    e.session = active;
    throw e;
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

function extractAccessToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7);
  if (req.cookies?.jwt_access_token) return req.cookies.jwt_access_token;
  return null;
}