import type { Request, Response } from "express";
import { z } from "zod";
import { enqueueOrMatch, getStatus, cancel } from "../model/match-model.ts";

const ticketSchema = z.object({
  userId: z.string().min(1),
  language: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).transform((s) => s.toLowerCase()),
  topic: z.string().min(1),
  ttlMs: z.number().int().positive().max(10 * 60 * 1000), // cap at 10m
});

export async function requestMatch(req: Request, res: Response) {
  try {
    const body = ticketSchema.parse(req.body);
    const result = await enqueueOrMatch(body);
    return res.status(200).json(result);
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: "Invalid payload", details: err.issues });
    return res.status(500).json({ error: "Internal error" });
  }
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
