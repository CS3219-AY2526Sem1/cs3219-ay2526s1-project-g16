// src/controller/match-controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { getStatus } from "../model/match-model.ts";
import { checkIfUserInMatch } from "./match-controller.ts";
import { subscribeUser } from "./match-pg-listener.ts";

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
    res.end();
  };

  let startedAt = new Date();

  try {
    await checkIfUserInMatch(req, res);
  } catch (e: any) {
    if (e?.code === "ALREADY_IN_ACTIVE_SESSION") {
      return safeEnd("MATCH_FOUND", { session: e.session });
    }
  }

  try {
    const initial = await getStatus(userId);
    const st = (initial as any)?.startedTime;
    if (st && !Number.isNaN(Date.parse(st))) {
      startedAt = new Date(st);
    }
  } catch {
    // ignore; keep polling
  }

  let stopped = false;

  const off = subscribeUser(userId, (msg) => {
    if (stopped || res.writableEnded) return;

    const s = msg.status.toUpperCase();

    if (s === "MATCHED") {
      stopped = true;
      safeEnd("MATCH_FOUND", msg);
    } else if (["CANCELLED", "EXPIRED"].includes(s)) {
      stopped = true;
      safeEnd("TIMEOUT", msg);
    }
  });

  const timeout = setTimeout(() => {
    if (!stopped) {
      stopped = true;
      safeEnd("TIMEOUT", { message: "No match found" });
    }
  }, SSE_WINDOW_MS);

  req.on("close", () => {
    stopped = true;
    off();          // unsubscribe
    clearInterval(heartbeat);
    clearTimeout(timeout);
  });
}
