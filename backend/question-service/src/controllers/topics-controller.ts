import type { Request, Response } from "express";
import { getAllTopics, hardDeleteTopicById } from "../model/topic-model.ts";

/* returns list of all topics */
export const listTopicsHandler = async (req: Request, res: Response) => {
  try {
    const topics = await getAllTopics();
    res.status(200).json({
      count: topics.length,
      topics,
    });
  } catch (error) {
    console.error("Failed to retrieve topics:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
};

/**
 * Permanently delete a topic (hard delete).
 */
export const hardDeleteTopicHandler = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const deleted = await hardDeleteTopicById(id);
  res.status(200).json({ message: "Topic permanently deleted", deleted });
};