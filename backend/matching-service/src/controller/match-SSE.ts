import type { Request, Response } from "express";
import { z } from "zod";
import { getStatus } from "../model/match-model.ts";

type SignalPayload = any;

const matchSignals = new Map<string, Set<(data: SignalPayload) => void>>();

function registerSignal(userId: string, fn: (data: SignalPayload) => void) {
  let set = matchSignals.get(userId);
  if (!set) {
    set = new Set();
    matchSignals.set(userId, set);
  }
  set.add(fn);
  return () => {
    const s = matchSignals.get(userId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) matchSignals.delete(userId);
  };
}

function fireSignal(userId: string, data: SignalPayload): number {
  const listeners = matchSignals.get(userId);
  if (!listeners || listeners.size === 0) return 0;
  listeners.forEach((fn) => fn(data));
  matchSignals.delete(userId);
  return listeners.size;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function subscribeMatchSSE(req: Request, res: Response) {
  const parsed = z.string().min(1).safeParse(req.params.userId);
  if (!parsed.success) {
    res.status(400).end("Invalid userId");
    return;
  }
  const userId = parsed.data;

  const ttlMsRaw = Number(req.query.ttlMs);
  const pollMsRaw = Number(req.query.pollMs);
  const SSE_WINDOW_MS =
    Number.isFinite(ttlMsRaw) && ttlMsRaw > 0
      ? Math.min(ttlMsRaw, 10 * 60 * 1000)
      : 30_000;
  const POLL_MS =
    Number.isFinite(pollMsRaw) && pollMsRaw > 0
      ? Math.max(200, Math.min(pollMsRaw, 5000))
      : 1000;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let heartbeat: NodeJS.Timeout | null = null;
  let timeout: NodeJS.Timeout | null = null;
  let pollerActive = true;
  let unregisterSignal: (() => void) | null = null;
  let stopped = false;

  const safeClear = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (unregisterSignal) {
      try { unregisterSignal(); } catch {}
      unregisterSignal = null;
    }
    pollerActive = false;
  };

  const safeEnd = (event: "MATCH_FOUND" | "TIMEOUT", data: any) => {
    if (res.writableEnded) return;

    let roomId: string | null = null;
    if (data && typeof data === "object") {
      const d = data as any;
      if (d.session && typeof d.session === "object" && d.session.roomId) {
        roomId = String(d.session.roomId);
      } else if (d.roomId) {
        roomId = String(d.roomId);
      }
    }

    try {
      res.write(`event: ${event}\n`);
      if (roomId) {
        res.write(`roomId: ${roomId}\n`);
      }
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch { /* ignore write errors */ }
    stopped = true;
    safeClear();
    res.end();
  };

  heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(`event: heartbeat\ndata: {}\n\n`);
  }, 15_000);

  unregisterSignal = registerSignal(userId, (data: any) => {
    if (stopped || res.writableEnded) return;
    safeEnd("MATCH_FOUND", data ?? { message: "Signalled match" });
  });

  (async () => {
    while (pollerActive && !stopped && !res.writableEnded) {
      try {
        const st = await getStatus(userId); // shape: { status: string, ... }
        const s = String((st as any)?.status ?? "").toUpperCase();
        if (s === "MATCHED") {
          return safeEnd("MATCH_FOUND", st);
        }
        if (s === "CANCELLED" || s === "EXPIRED") {
          return safeEnd("TIMEOUT", st);
        }
      } catch {
        // ignore transient errors; keep pollin
      }
      await delay(POLL_MS);
    }
  })();

  timeout = setTimeout(() => {
    if (!stopped) safeEnd("TIMEOUT", { message: "No match found" });
  }, SSE_WINDOW_MS);

  req.on("close", () => {
    stopped = true;
    safeClear();
  });
}

export function signalMatchFound(req: Request, res: Response) {
  const parsedUserId = z.string().min(1).safeParse(req.params.userId);
  if (!parsedUserId.success) return res.status(400).json({ error: "Invalid userId" });
  const userId = parsedUserId.data;

  const parsedRoomId = z.string().min(1).optional().safeParse(req.body?.roomId ?? req.query?.roomId);
  const roomId = parsedRoomId.success ? parsedRoomId.data : undefined;

  const payload = {
    session: {
      userId,
      roomId: roomId ?? null,
      via: "manual-signal",
      at: new Date().toISOString(),
    },
    ...(typeof req.body === "object" && req.body ? req.body : {}),
  };

  const delivered = fireSignal(userId, payload);
  if (delivered === 0) {
    return res.status(404).json({ error: "No live SSE subscribers for userId" });
  }

  return res.json({ ok: true, delivered, userId, roomId });
}
