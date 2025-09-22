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

export const createUser = async (
    username: string,
    email: string,
    passwordHash: string,
) => {
    return await prisma.user.create({
        data: {
            username,
            email,
            passwordHash,
        },
    });
};

export const getUserByUsername = async (username: string) => {
    return await prisma.user.findUnique({
        where: { username },
    });
};

export const getUserByEmail = async (email: string) => {
    return await prisma.user.findUnique({
        where: { email },
    });
};

export const getUserById = async (id: string) => {
    return await prisma.user.findUnique({
        where: { id },
    });
};
