import type { Request, Response } from "express";
import { z } from "zod";
import { enqueueOrMatch, getStatus, cancel } from "../model/match-model.ts";

const strOrArray = z.union([z.string().min(1), z.array(z.string().min(1))]).optional();

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

    return res.status(result?.status === "matched" ? 200 : 202).json({
      ...result,
      subscribeUrl,
    });
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: "Invalid payload", details: err.issues });
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

      // track start time if present
      const st = (status as any)?.startedTime;
      if (st && !Number.isNaN(Date.parse(st))) startedAt = new Date(st);

      const s = status?.status;

      // Terminal outcomes:
      // - "matched" -> in your model, match will delete tickets, and soon getStatus => not_found.
      //   We still surface the terminal event once and close.
      // - "cancelled" -> your cancel() deletes; status may report "cancelled" or soon "not_found".
      // - "not_found" -> no active ticket; end stream.
      if (s === "matched" || s === "cancelled" || s === "not_found") {
        writeSSE(res, s ?? "not_found", status ?? {});
        return safeCleanup();
      }

      // Guard against local SSE window expiration (client UX)
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
    const result = await cancel(userId); // should DELETE the ticket in your model
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: "Invalid userId" });
    return res.status(500).json({ error: "Internal error" });
  }
}
