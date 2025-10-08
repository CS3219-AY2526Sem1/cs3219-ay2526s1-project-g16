import { prisma } from "./prisma-client.ts";
import type { User } from "../generated/prisma/index.js";

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

export const getUserByUsername = async (
  username: string,
): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { username },
  });
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { email },
  });
};

export const getUserById = async (id: string): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { id },
  });
};
