-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "matchservice";

-- CreateTable
CREATE TABLE "matchservice"."matchticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "languagePref" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficultyPref" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topicPref" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL,
    "partnerId" TEXT,
    "roomId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matchticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matchservice"."matchedusers" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "questionId" TEXT,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matchedusers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matchticket_userId_key" ON "matchservice"."matchticket"("userId");

-- CreateIndex
CREATE INDEX "matchticket_status_expiresAt_createdAt_idx" ON "matchservice"."matchticket"("status", "expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "matchticket_roomId_idx" ON "matchservice"."matchticket"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "matchedusers_roomId_key" ON "matchservice"."matchedusers"("roomId");

