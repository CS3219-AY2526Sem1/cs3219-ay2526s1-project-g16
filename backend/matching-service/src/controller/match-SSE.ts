// src/controller/match-controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { getStatus } from "../model/match-model.ts";
import { subscribeUser } from "./match-pg-listener.ts";

const matchSignals = new Map<string, Set<(data: any) => void>>();

function registerSignal(userId: string, fn: (data: any) => void) {
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

function fireSignal(userId: string, data: any): number {
  const listeners = matchSignals.get(userId);
  if (!listeners || listeners.size === 0) return 0;
  listeners.forEach(fn => fn(data));
  matchSignals.delete(userId);
  return listeners.size;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function subscribeMatchSSE(req: Request, res: Response) {
  const parseUserId = z.string().min(1).safeParse(req.params.userId);
  if (!parseUserId.success) {
    res.status(400).end("Invalid userId");
    return;
  }
  const userId = parseUserId.data;

  const ttlMsParam = Number(req.query.ttlMs);
  const SSE_WINDOW_MS =
    Number.isFinite(ttlMsParam) && ttlMsParam > 0
      ? Math.min(ttlMsParam, 10 * 60 * 1000)
      : 30_000;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(`event: heartbeat\ndata: {}\n\n`);
  }, 15_000);

  const safeEnd = (event: "MATCH_FOUND" | "TIMEOUT", data: any) => {
    if (res.writableEnded) return;
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    clearInterval(heartbeat);
    clearTimeout(timeout);
    unregisterSignal();
    off();
    res.end();
  };

  let startedAt = new Date();
  let stopped = false;

  try {
    await delay(5000);
  } catch (e: any) {
    if (e?.code === "ALREADY_IN_ACTIVE_SESSION") {
      return safeEnd("MATCH_FOUND", { session: e.session });
    }
  }

  try {
    const initial = await getStatus(userId);
    const st = (initial as any)?.startedTime;
    if (st && !Number.isNaN(Date.parse(st))) startedAt = new Date(st);
  } catch {
    /* ignore */
  }
  const off = subscribeUser(userId, (msg) => {
    if (stopped || res.writableEnded) return;
    const s = String(msg.status).toUpperCase();
    if (s === "MATCHED") {
      stopped = true;
      safeEnd("MATCH_FOUND", msg);
    } else if (["CANCELLED", "EXPIRED"].includes(s)) {
      stopped = true;
      safeEnd("TIMEOUT", msg);
    }
  });

  const unregisterSignal = registerSignal(userId, (data: any) => {
    if (stopped || res.writableEnded) return;
    stopped = true;
    safeEnd("MATCH_FOUND", data ?? { message: "Signalled match" });
  });

  const timeout = setTimeout(() => {
    if (!stopped) {
      stopped = true;
      safeEnd("TIMEOUT", { message: "No match found" });
    }
  }, SSE_WINDOW_MS);

  req.on("close", () => {
    stopped = true;
    off();
    unregisterSignal();
    clearInterval(heartbeat);
    clearTimeout(timeout);
  });
}

export function signalMatchFound(req: Request, res: Response) {
  const parseUserId = z.string().min(1).safeParse(req.params.userId);
  if (!parseUserId.success) return res.status(400).json({ error: "Invalid userId" });
  const userId = parseUserId.data;

  const payload = {
    session: {
      userId,
      via: "manual-signal",
      at: new Date().toISOString(),
    },
    ...(typeof req.body === "object" ? req.body : {}),
  };

  const delivered = fireSignal(userId, payload);
  if (delivered === 0) return res.status(404).json({ error: "No live SSE subscribers for userId" });

  return res.json({ ok: true, delivered });
}