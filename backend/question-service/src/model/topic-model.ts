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

/* returns all active topics only */
export const getAllTopics = async () => {
  try {
    const topics = await prisma.topic.findMany({
      where: {
      questions: {
        some: { question: { deletedAt: null } },
      },
    },
      orderBy: { name: "asc" },
    });
    return topics;
  } catch (error) {
    console.error("Error fetching topics:", error);
    throw error;
  }
};

/**
 * HARD Delete topics by Id 
 * Because of the joint table, we delete those mappings first to avoid referential constraint errors.
 */
export const hardDeleteTopicById = async (id: number) => {
  return prisma.$transaction(async (tx) => {
    await tx.topic.findUniqueOrThrow({ where: { id } });

    // Remove join rows
    await tx.questionTopic.deleteMany({ where: { topicId: id } });

    const deleted = await tx.topic.delete({
      where: { id },
    });

    return deleted;
  });
};

