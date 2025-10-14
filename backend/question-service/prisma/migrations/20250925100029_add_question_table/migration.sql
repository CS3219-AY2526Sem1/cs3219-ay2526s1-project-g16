-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "questionservice";

-- CreateEnum
CREATE TYPE "questionservice"."Difficulty" AS ENUM ('Easy', 'Medium', 'Hard');

-- CreateTable
CREATE TABLE "questionservice"."questions" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "difficulty" "questionservice"."Difficulty" NOT NULL,
    "topic" TEXT NOT NULL,
    "exampleIO" TEXT NOT NULL,
    "constraints" TEXT NOT NULL,
    "solutionOutline" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);
