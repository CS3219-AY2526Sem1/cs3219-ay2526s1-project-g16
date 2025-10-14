/*
  Warnings:

  - You are about to drop the column `topic` on the `questions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "questionservice"."questions" DROP COLUMN "topic";

-- CreateTable
CREATE TABLE "questionservice"."topics" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questionservice"."question_topics" (
    "questionId" INTEGER NOT NULL,
    "topicId" INTEGER NOT NULL,

    CONSTRAINT "question_topics_pkey" PRIMARY KEY ("questionId","topicId")
);

-- CreateIndex
CREATE UNIQUE INDEX "topics_name_key" ON "questionservice"."topics"("name");

-- AddForeignKey
ALTER TABLE "questionservice"."question_topics" ADD CONSTRAINT "question_topics_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questionservice"."questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionservice"."question_topics" ADD CONSTRAINT "question_topics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "questionservice"."topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
