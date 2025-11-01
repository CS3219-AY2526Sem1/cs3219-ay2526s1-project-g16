import type { Request, Response } from "express";
import { getAllTopics } from "../model/topic-model.ts";

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
