import type { Request, Response } from "express";
import type { attempt } from "../generated/prisma/index.js";
import {
  addAttempt as _addAttempt,
  getAttemptsByUserId as _getAttemptsByUserId,
  getUniqueQuestionsByUserId as _getUniqueQuestionsByUserId,
} from "../model/attempt.ts";

export async function addAttempt(req: Request, res: Response): Promise<void> {
  try {
    const { userId, matchUsername, question, code } = req.body;

    if (req.user?.id != userId) {
      res.status(401).json({ error: "Unauthorized to add this attempt" });
      return;
    }

    if (
      typeof userId !== "string" ||
      typeof matchUsername !== "string" ||
      typeof question !== "number" ||
      typeof code !== "string"
    ) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    await _addAttempt(userId, matchUsername, question, code);

    res.status(201).json({ message: "Attempt created" });
    return;
  } catch (error) {
    res.status(500).json({ error: "Internal server error: " + error });
    return;
  }
}

export async function getAttemptsByUserId(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.params.userId;

    if (typeof userId !== "string") {
      res.status(400).json({ error: "Invalid username" });
      return;
    }

    // Parse pagination query params
    const page = Number(req.query.page) || 0;
    const pageSize = Number(req.query.pageSize) || 10;

    const attempts: attempt[] = await _getAttemptsByUserId(
      userId,
      page,
      pageSize,
    );

    res.status(200).json(attempts);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" + error });
  }
}

export async function getUniqueQuestionsByUserId(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const username = req.params.userId;

    if (typeof username !== "string") {
      res.status(400).json({ error: "Invalid username" });
      return;
    }

    const questions: number[] = await _getUniqueQuestionsByUserId(username);

    res.status(200).json(questions);
  } catch (error) {
    console.error("Error fetching unique questions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
