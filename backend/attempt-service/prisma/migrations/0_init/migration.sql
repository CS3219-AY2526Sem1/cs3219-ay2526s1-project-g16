-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "attempt-hist";

-- CreateTable
CREATE TABLE "attempt-hist"."attempt" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "matchUsername" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionTags" TEXT[],
    "difficulty" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempt_pkey" PRIMARY KEY ("id")
);

