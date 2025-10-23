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

export const getAllTopics = async () => {
  try {
    const topics = await prisma.topic.findMany({
      orderBy: { name: "asc" },
    });
    return topics;
  } catch (error) {
    console.error("Error fetching topics:", error);
    throw error;
  }
};
