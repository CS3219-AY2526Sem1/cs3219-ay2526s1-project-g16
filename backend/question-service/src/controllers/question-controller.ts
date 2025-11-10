import type { Request, Response } from "express";
import { z } from "zod";
import {
  createQuestion,
  getQuestionById,
  listQuestions,
  updateQuestion,
  deleteQuestionById,
  hardDeleteQuestionById,
  type ListQuestionsParams,
  type UpdateQuestionInput,
} from "../model/question-model.ts";

const Difficulty = z.enum(["Easy", "Medium", "Hard"]);

const createSchema = z.object({
  title: z.string().min(1),
  statement: z.string().min(1),
  difficulty: Difficulty,
  topicNames: z.array(z.string().min(1)).default([]),
  exampleIO: z
    .array(z.object({ input: z.string(), output: z.string() }))
    .default([]),
  constraints: z.array(z.string()).default([]),
  solutionOutline: z.string().min(1),
  metadata: z.any().optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  statement: z.string().min(1).optional(),
  difficulty: Difficulty.optional(),
  topicNames: z.array(z.string().min(1)).optional(),
  exampleIO: z
    .array(z.object({ input: z.string(), output: z.string() }))
    .optional(),
  constraints: z.array(z.string()).optional(),
  solutionOutline: z.string().min(1).optional(),
  metadata: z.any().nullable().optional(),
});

export const createQuestionHandler = async (req: Request, res: Response) => {
  const data = createSchema.parse(req.body);
  const created = await createQuestion(data);
  res.status(201).json(created);
};

export const getQuestionHandler = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const q = await getQuestionById(id);
  if (!q) return res.status(404).json({ error: "Not Found" });
  res.json(q);
};

export const listQuestionsHandler = async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const isAll = q.take === "all";

  const parsed: ListQuestionsParams = {
    ...(q.id ? { id: Number(q.id) } : {}),
    ...(q.search ? { search: q.search } : {}),
    ...(q.topicNames
      ? {
          topicNames: q.topicNames
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : {}),
    ...(q.difficulty
      ? {
          difficulty: q.difficulty.includes(",")
            ? (q.difficulty.split(",").map((d) => d.trim()) as Array<
                "Easy" | "Medium" | "Hard"
              >)
            : (q.difficulty as "Easy" | "Medium" | "Hard"),
        }
      : {}),
    ...(q.orderBy
      ? { orderBy: q.orderBy as "newest" | "oldest" | "title" }
      : {}),
    skip: Number(q.skip ?? "0"),
    ...(isAll ? {} : { take: Number(q.take ?? "25") }),
  };

  const result = await listQuestions(parsed);
  res.json(result);
};

export const updateQuestionHandler = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const raw = updateSchema.parse(req.body);

  const patch = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  ) as UpdateQuestionInput;

  const updated = await updateQuestion(id, patch);
  res.json(updated);
};

export const deleteQuestionHandler = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  await deleteQuestionById(id);
  res.status(204).send();
};

/**
 * Permanently delete a question (hard delete).
 */
export const hardDeleteQuestionHandler = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const deleted = await hardDeleteQuestionById(id);
  res.status(200).json({ message: "Question permanently deleted", deleted });
};