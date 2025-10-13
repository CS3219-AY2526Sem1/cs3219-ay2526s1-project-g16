import { prisma } from "./prisma-client.ts";
import type { attempt } from "../generated/prisma/index.js";

export async function addAttempt(
  username: string,
  matchUsername: string,
  question: number,
  code: string,
): Promise<attempt> {
  const newAttempt = await prisma.attempt.create({
    data: {
      username,
      matchUsername,
      question,
      code,
    },
  });

  return newAttempt;
}

export async function getAttemptsByUsername(
  username: string,
): Promise<attempt[]> {
  const attempts = await prisma.attempt.findMany({
    where: {
      username,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return attempts;
}

export async function getUniqueQuestionsByUsername(
  username: string,
): Promise<number[]> {
  const uniqueQuestions = await prisma.attempt.findMany({
    where: {
      username,
    },
    distinct: ["question"],
    select: {
      question: true,
    },
    orderBy: {
      question: "asc",
    },
  });

  return uniqueQuestions.map((entry) => entry.question);
}
