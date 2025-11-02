// src/controller/match-controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { getStatus } from "../model/match-model.ts";
import { checkIfUserInMatch } from "./match-controller.ts";

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
  const poll = async () => {
    if (stopped || res.writableEnded) return;

    try {
      const status = await getStatus(userId);
      const s = status?.status;

      if (s === "matched") {
        return safeEnd("MATCH_FOUND", status ?? {});
      }

      const st = (status as any)?.startedTime;
      if (st && !Number.isNaN(Date.parse(st))) {
        startedAt = new Date(st);
      }
    } catch {
      // keep polling
    }

    if (Date.now() - +startedAt > SSE_WINDOW_MS) {
      stopped = true;
      return safeEnd("TIMEOUT", {
        message: "No match found",
        startedTime: startedAt,
        ttlMs: SSE_WINDOW_MS,
      });
    }

    setTimeout(poll, 1_000);
  };

  poll();

  req.on("close", () => {
    stopped = true;
    clearInterval(heartbeat);
  });
}
