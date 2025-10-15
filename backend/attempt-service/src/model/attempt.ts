import { prisma } from "./prisma-client.ts";
import type { attempt } from "../generated/prisma/index.js";

export async function addAttempt(
  userId: string,
  collabId: string,
  question: number,
  code: string,
): Promise<attempt> {
  const newAttempt = await prisma.attempt.create({
    data: {
      userId,
      collabId,
      question,
      code,
    },
  });

  return newAttempt;
}

export async function getAttemptsByUserId(
  userId: string,
  page: number = 0, // 1-based page number
  pageSize: number = 10, // records per page
): Promise<attempt[]> {
  const attempts = await prisma.attempt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: page * pageSize,
    take: pageSize,
  });

  return attempts;
}

export async function getUniqueQuestionsByUserId(
  userId: string,
): Promise<number[]> {
  const uniqueQuestions = await prisma.attempt.findMany({
    where: {
      userId,
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
