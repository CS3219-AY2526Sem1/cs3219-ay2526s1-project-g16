import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

export const createUser = async (username: string, email: string, passwordHash: string) => {
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
