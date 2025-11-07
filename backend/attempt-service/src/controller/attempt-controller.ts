import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { attempt } from "../generated/prisma/index.js";
import {
  addAttempt as _addAttempt,
  getAttemptsByUserId as _getAttemptsByUserId,
  getUniqueQuestionsByUserId as _getUniqueQuestionsByUserId,
} from "../model/attempt.ts";

const ACCESS_SECRET = process.env.ACCESS_JWT_SECRET || "access-secret";

export async function addAttempt(req: Request, res: Response): Promise<void> {
  try {
    const accessToken = req.cookies?.jwt_access_token;
    const decoded = jwt.verify(accessToken, ACCESS_SECRET);
    const userId = decoded.sub;
    const { collabId, questionId, content } = req.body;

    if (
      typeof userId !== "string" ||
      (collabId != null && typeof collabId !== "string") ||
      typeof questionId !== "number" ||
      typeof content !== "string"
    ) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    await _addAttempt(userId, collabId, questionId, content);

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
    const userId = req.params.id;

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
    const userId = req.params.id;

    if (typeof userId !== "string") {
      res.status(400).json({ error: "Invalid userId" });
      return;
    }

    const questions: number[] = await _getUniqueQuestionsByUserId(userId);

    res.status(200).json(questions);
    return;
  } catch (error) {
    console.error("Error fetching unique questions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
