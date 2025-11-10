import { PrismaClient, Prisma } from "../generated/prisma/index.js";

export const prisma = new PrismaClient();

export const initConnection = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("Prisma connected to questionservice");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  }
};

/* Create a Question */

export const createQuestion = async (data: {
  title: string;
  statement: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topicNames: string[];
  exampleIO: { input: string; output: string }[];
  constraints: string[];
  solutionOutline: string;
  metadata?: Prisma.InputJsonValue;
}) => {
  return await prisma.question.create({
    data: {
      title: data.title,
      statement: data.statement,
      difficulty: data.difficulty,
      solutionOutline: data.solutionOutline,
      exampleIO: data.exampleIO as Prisma.InputJsonValue,
      constraints: data.constraints as Prisma.InputJsonValue,
      metadata:
        data.metadata ?? (Prisma.JsonNull as Prisma.NullableJsonNullValueInput),
      topics: {
        create: data.topicNames.map((name) => ({
          topic: {
            connectOrCreate: {
              where: { name },
              create: { name },
            },
          },
        })),
      },
    },
    include: { topics: { include: { topic: true } } },
  });
};

/* Read a Question by ID (active qns only) */
export const getQuestionById = async (id: number) => {
  return prisma.question.findFirst({
    where: { id },
    include: { topics: { include: { topic: true } } },
  });
};

export type ListQuestionsParams = {
  search?: string;
  topicNames?: string[];
  difficulty?: "Easy" | "Medium" | "Hard" | Array<"Easy" | "Medium" | "Hard">;
  orderBy?: "newest" | "oldest" | "title";
  skip?: number;
  take?: number;
};

export const listQuestions = async (params: ListQuestionsParams = {}) => {
  const {
    search,
    topicNames,
    difficulty,
    orderBy = "newest",
    skip = 0,
    take,
  } = params;

  const where: Prisma.QuestionWhereInput = {
    deletedAt: null,
    AND: [
      search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              {
                statement: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {},
      Array.isArray(difficulty)
        ? { difficulty: { in: difficulty } }
        : difficulty
          ? { difficulty }
          : {},
      topicNames && topicNames.length
        ? {
            topics: {
              some: { topic: { name: { in: topicNames } } },
            },
          }
        : {},
    ],
  };

  const orderByClause: Prisma.QuestionOrderByWithRelationInput =
    orderBy === "title"
      ? { title: "asc" }
      : {
          createdAt: orderBy === "oldest" ? "asc" : "desc",
        };

  const query: Prisma.QuestionFindManyArgs = {
    where,
    orderBy: orderByClause,
  };

  if (typeof take === "number") {
    query.skip = skip ?? 0;
    query.take = take;
  }

  return prisma.question.findMany(query);
};

export type UpdateQuestionInput = {
  title?: string;
  statement?: string;
  difficulty?: "Easy" | "Medium" | "Hard";
  exampleIO?: { input: string; output: string }[];
  constraints?: string[];
  solutionOutline?: string;
  metadata?: Prisma.InputJsonValue | null;
  topicNames?: string[];
};

export const updateQuestion = async (oldId: number, patch: UpdateQuestionInput) => {
  return prisma.$transaction(async (tx) => {
    const old = await tx.question.findFirst({
      where: { id: oldId, deletedAt: null },
      include: { topics: { include: { topic: true } } },
    });
    if (!old) throw new Error("Question not found or already archived");

    const names =
      patch.topicNames !== undefined
        ? [...new Set(patch.topicNames.map((n) => n.trim()))].filter(Boolean)
        : undefined; // undefined => copy old, [] => clear

    const newQ = await tx.question.create({
      data: {
        title: patch.title ?? old.title,
        statement: patch.statement ?? old.statement,
        difficulty: (patch.difficulty ?? old.difficulty) as any,
        constraints:
          (patch.constraints as unknown as Prisma.InputJsonValue) ??
          ((old.constraints as unknown as Prisma.InputJsonValue) ??
            (Prisma.JsonNull as Prisma.NullableJsonNullValueInput)),
        exampleIO:
          (patch.exampleIO as unknown as Prisma.InputJsonValue) ??
          ((old.exampleIO as unknown as Prisma.InputJsonValue) ??
            (Prisma.JsonNull as Prisma.NullableJsonNullValueInput)),
        solutionOutline: patch.solutionOutline ?? old.solutionOutline,
        metadata:
          patch.metadata !== undefined
            ? (patch.metadata as Prisma.InputJsonValue)
            : (old.metadata as Prisma.InputJsonValue) ??
              (Prisma.JsonNull as Prisma.NullableJsonNullValueInput),
        topics: {
          create:
            names !== undefined
              ?
                names.map((name) => ({
                  topic: {
                    connectOrCreate: {
                      where: { name },
                      create: { name },
                    },
                  },
                }))
              : 
                old.topics.map((qt) => ({ topic: { connect: { id: qt.topic.id } } })),
        },
      },
      include: { topics: { include: { topic: true } } },
    });

    await tx.question.update({
      where: { id: old.id },
      data: { deletedAt: new Date() },
    });

    return newQ;
  });
};


/**
 * Soft delete a question by ID.
 * - Marks the question as archived by setting `deletedAt`.
 * - Keeps question_topic rows intact (history preserved).
 * - Throws if the question doesn't exist or is already deleted.
 */
export const deleteQuestionById = async (id: number) => {
  return prisma.$transaction(async (tx) => {
    // 1) Ensure the question exists AND is not already soft-deleted
    const exists = await tx.question.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new Error("Question not found or already deleted");
    }

    // 2) Soft delete: set deletedAt (do NOT remove join rows)
    const deleted = await tx.question.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { topics: { include: { topic: true } } },
    });

    // 3) Optionally: you could trigger a background cleanup of orphan topics
    //    (only if no active questions reference them). Not done here.

    return deleted;
  });
};


/**
 * HARD Delete question by Id.
 * Because of the joint table, we delete those mappings first to avoid referential constraint errors.
 */
export const hardDeleteQuestionById = async (id: number) => {
  return prisma.$transaction(async (tx) => {
    // Ensure it exists (throws if not)
    await tx.question.findUniqueOrThrow({ where: { id } });

    // Remove join rows
    await tx.questionTopic.deleteMany({ where: { questionId: id } });

    // Delete the question
    const deleted = await tx.question.delete({
      where: { id },
      include: { topics: { include: { topic: true } } },
    });

    return deleted;
  });
};
