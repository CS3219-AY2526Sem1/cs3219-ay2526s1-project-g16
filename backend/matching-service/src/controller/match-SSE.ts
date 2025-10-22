// src/controller/match-controller.ts
import type { Request, Response } from "express";
import { z } from "zod";
import { getStatus } from "../model/match-model.ts";
import { subscribeUser } from "./match-pg-listener.ts";

function writeSSE(res: Response, event: string, data: any, id?: string) {
  if (id) res.write(`id: ${id}\n`);
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function subscribeMatchSSE(req: Request, res: Response) {
  const parsed = z.string().min(1).safeParse(req.params.userId);
  if (!parsed.success) {
    res.status(400).end("Invalid userId");
    return;
  }
  const userId = parsed.data;

  // SSE header
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(`event: heartbeat\ndata: {}\n\n`);
  }, 15_000);

  let ended = false;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    clearInterval(heartbeat);
    try { off?.(); } catch { }
    if (!res.writableEnded) res.end();
  };

  try {
    const initial = await getStatus(userId);
    writeSSE(res, "status", initial);

    if (initial.status === "not_found") {
      // RUN CollabService API call to check if match is found
      cleanup();
      return;
    }
    if (initial.status === "matched" || initial.status === "cancelled") {
      writeSSE(res, initial.status, initial);
      cleanup();
      return;
    }
  } catch {
    writeSSE(res, "error", { message: "initial status failed" });
  }

  let off = subscribeUser(userId, (msg) => {
    if (ended || res.writableEnded) return;
      const evt =
        msg.status === "MATCHED"   ? "matched"   :
        msg.status === "CANCELLED" ? "cancelled" :
        msg.status === "EXPIRED"   ? "timeout"   :
        msg.status === "DELETED"   ? "timeout"   :
        "status";
    const payload = {
      status: evt === "timeout" ? "not_found" : String(msg.status || "").toLowerCase(),
      roomId: msg.roomId ?? undefined,
      partnerId: msg.partnerId ?? undefined,
      expiresAt: msg.expiresAt ?? undefined,
      startedTime: msg.createdAt ?? undefined,
    };
    writeSSE(res, evt, payload);
    if (evt === "matched" || evt === "cancelled" || evt === "timeout") {
      cleanup();
    }
  });
  req.on("close", cleanup);
}
