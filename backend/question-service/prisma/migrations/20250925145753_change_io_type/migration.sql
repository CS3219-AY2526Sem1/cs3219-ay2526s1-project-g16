/*
  Warnings:

  - The `exampleIO` column on the `questions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `constraints` column on the `questions` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "questionservice"."questions" DROP COLUMN "exampleIO",
ADD COLUMN     "exampleIO" JSONB,
DROP COLUMN "constraints",
ADD COLUMN     "constraints" JSONB;
