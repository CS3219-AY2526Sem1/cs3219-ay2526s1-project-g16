-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "collab";

-- CreateEnum
CREATE TYPE "collab"."SessionStatus" AS ENUM ('ACTIVE', 'ENDED', 'TIMED_OUT');

-- CreateTable
CREATE TABLE "collab"."sessions" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "questionId" TEXT,
    "status" "collab"."SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collab"."participants" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participants_sessionId_userId_key" ON "collab"."participants"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "collab"."participants" ADD CONSTRAINT "participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "collab"."sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
