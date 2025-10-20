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
  let userId: string;
  try {
    userId = z.string().min(1).parse(req.params.userId);
  } catch {
    res.status(400).end("Invalid userId");
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const initial = await getStatus(userId);
    writeSSE(res, "status", initial);
    if (["matched","cancelled","not_found"].includes(initial.status)) {
      res.end();
      return;
    }
  } catch (e) {
    writeSSE(res, "error", { message: "initial status failed" });
  }

  const off = subscribeUser(userId, (msg) => {
    const evt =
      msg.status === "MATCHED"    ? "matched"   :
      msg.status === "CANCELLED"  ? "cancelled" :
      msg.status === "EXPIRED"    ? "timeout"   :
      "status";

    writeSSE(res, evt, {
      status: evt === "timeout" ? "not_found" : msg.status.toLowerCase(),
      roomId: msg.roomId ?? undefined,
      partnerId: msg.partnerId ?? undefined,
      expiresAt: msg.expiresAt ?? undefined,
      startedTime: msg.createdAt ?? undefined,
    });

    if (evt === "matched" || evt === "cancelled" || evt === "timeout") {
      cleanup();
    }
  });

  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(`event: heartbeat\ndata: {}\n\n`);
  }, 15000);

  function cleanup() {
    clearInterval(heartbeat);
    off();
    if (!res.writableEnded) res.end();
  }

  req.on("close", cleanup);
}
