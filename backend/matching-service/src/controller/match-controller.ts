import type { Request, Response } from "express";
import { z } from "zod";
import { enqueueOrMatch, getStatus, cancel } from "../model/match-model.ts";

const strOrArray = z
  .union([z.string().min(1), z.array(z.string().min(1))])
  .optional();

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
    const body: TicketInput = ticketSchema.parse(req.body);
    const result = await enqueueOrMatch(body);

    const base = `${req.protocol}://${req.get("host")}`;
    const subscribeUrl = `${base}/match/subscribe/${encodeURIComponent(body.userId)}`;

    // call qy api to start collabservice
    // choose one topic language difficulty
    return res.status(result?.status === "matched" ? 200 : 202).json({
      ...result,
      subscribeUrl,
    });
  } catch (err: any) {
    if (err?.issues)
      return res.status(400).json({ error: "Invalid payload", details: err.issues });
    return res.status(500).json({ error: "Internal error" });
  }
}

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

  res.write(": connected\n\n");

  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: {}\n\n`);
  }, 15000);

  const SSE_WINDOW_MS = 30 * 1000; 
  let lastSig = "";

  let startedAt = new Date();
  try {
    const initial = await getStatus(userId);
    if (initial?.startedTime) {
      startedAt = new Date(initial.startedTime);
    }
    writeSSE(res, "status", initial ?? { status: "not_found" });
    lastSig = JSON.stringify(initial ?? {});
  } catch {
    // if we can't fetch status initially, still proceed; poller will handle.
  }

  async function poll() {
    try {
      const status = await getStatus(userId);
      const sig = JSON.stringify(status ?? {});
      if (sig !== lastSig) {
        lastSig = sig;
        writeSSE(res, "status", status ?? { status: "not_found" });
      }

      if ((status as any)?.startedTime && !Number.isNaN(Date.parse((status as any).startedTime as any))) {
        startedAt = new Date((status as any).startedTime as any);
      }

      const s = status?.status;
      if (s === "matched" || s === "cancelled" || s === "not_found") {
        writeSSE(res, s, status);
        cleanup();
        return;
      }

      const expiresAt = (status as any)?.expiresAt ? new Date((status as any).expiresAt as any) : null;
      if (expiresAt && Date.now() >= +expiresAt) {
        writeSSE(res, "timeout", { message: "Ticket expired", startedTime: startedAt, expiresAt });
        cleanup();
        return;
      }

      if (Date.now() - +startedAt > SSE_WINDOW_MS) {
        writeSSE(res, "timeout", { message: "No match found", startedTime: startedAt });
        cleanup();
        return;
      }
    } catch {
      writeSSE(res, "error", { message: "poll failed" });
    }

    if (!res.writableEnded) setTimeout(poll, 1000);
  }

  poll();

  function cleanup() {
    clearInterval(heartbeat);
    res.end();
  }

  req.on("close", cleanup);
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
