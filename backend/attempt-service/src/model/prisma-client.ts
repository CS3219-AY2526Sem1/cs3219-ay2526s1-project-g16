import { PrismaClient } from "../generated/prisma/index.js";

export const prisma = new PrismaClient();

export const initConnection = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("Prisma connected");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1); // Exit the app if DB connection fails
  }
};
