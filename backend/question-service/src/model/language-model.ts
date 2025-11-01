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

export const getAllLanguages = async () => {
  try {
    const languages = await prisma.language.findMany({
      orderBy: { name: "asc" },
    });
    return languages;
  } catch (error) {
    console.error("Error fetching languages:", error);
    throw error;
  }
};
