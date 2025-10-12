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
                data.metadata ??
                (Prisma.JsonNull as Prisma.NullableJsonNullValueInput),
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

/* Read a Question by ID*/
export const getQuestionById = async (id: number) => {
    return prisma.question.findUnique({
        where: { id },
        include: { topics: { include: { topic: true } } },
    });
};

export type ListQuestionsParams = {
    search?: string; // matches title or statement
    topicNames?: string[]; // match any of the provided topic names
    difficulty?:
        | ("Easy" | "Medium" | "Hard")
        | Array<"Easy" | "Medium" | "Hard">;
    orderBy?: "newest" | "oldest" | "title";
    skip?: number;
    take?: number; // limit
};

export const listQuestions = async (params: ListQuestionsParams = {}) => {
    const {
        search,
        topicNames,
        difficulty,
        orderBy = "newest",
        skip = 0,
        take = 25,
    } = params;

    const where: Prisma.QuestionWhereInput = {
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
        orderBy === "oldest"
            ? { createdAt: "asc" }
            : orderBy === "title"
              ? { title: "asc" }
              : { createdAt: "desc" };

    const [items, total] = await prisma.$transaction([
        prisma.question.findMany({
            where,
            orderBy: orderByClause,
            skip,
            take,
            include: { topics: { include: { topic: true } } },
        }),
        prisma.question.count({ where }),
    ]);

    return { items, total, skip, take };
};

export type UpdateQuestionInput = {
    title?: string;
    statement?: string;
    difficulty?: "Easy" | "Medium" | "Hard";
    exampleIO?: { input: string; output: string }[];
    constraints?: string[];
    solutionOutline?: string;
    metadata?: Prisma.InputJsonValue | null; // pass null to clear
    topicNames?: string[]; // optional—if present, replaces all topics
};

export const updateQuestion = async (id: number, data: UpdateQuestionInput) => {
    // Build update data for scalar/JSON fields
    const updateData: Prisma.QuestionUpdateInput = {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.statement !== undefined && { statement: data.statement }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.solutionOutline !== undefined && {
            solutionOutline: data.solutionOutline,
        }),
        ...(data.exampleIO !== undefined && {
            exampleIO:
                (data.exampleIO as unknown as Prisma.InputJsonValue) ??
                (Prisma.JsonNull as Prisma.NullableJsonNullValueInput),
        }),
        ...(data.constraints !== undefined && {
            constraints:
                (data.constraints as unknown as Prisma.InputJsonValue) ??
                (Prisma.JsonNull as Prisma.NullableJsonNullValueInput),
        }),
        ...(data.metadata !== undefined && {
            metadata:
                data.metadata ??
                (Prisma.JsonNull as Prisma.NullableJsonNullValueInput),
        }),
    };

    // If topicNames provided, replace join rows in a transaction
    if (data.topicNames) {
        const topicNames = [
            ...new Set(data.topicNames.map((n) => n.trim())),
        ].filter(Boolean);

        return prisma.$transaction(async (tx) => {
            // Ensure the question exists (throws if not)
            await tx.question.findUniqueOrThrow({ where: { id } });

            // Remove current mappings
            await tx.questionTopic.deleteMany({ where: { questionId: id } });

            // Connect or create each topic, then create relation rows
            if (topicNames.length) {
                for (const name of topicNames) {
                    await tx.questionTopic.create({
                        data: {
                            question: { connect: { id } },
                            topic: {
                                connectOrCreate: {
                                    where: { name },
                                    create: { name },
                                },
                            },
                        },
                    });
                }
            }

            const updated = await tx.question.update({
                where: { id },
                data: updateData,
                include: { topics: { include: { topic: true } } },
            });

            return updated;
        });
    }

    // No topic replacement requested
    return prisma.question.update({
        where: { id },
        data: updateData,
        include: { topics: { include: { topic: true } } },
    });
};

/**
 * Delete question by Id.
 * Because of the joint table, we delete those mappings first to avoid referential constraint errors.
 */
export const deleteQuestionById = async (id: number) => {
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
