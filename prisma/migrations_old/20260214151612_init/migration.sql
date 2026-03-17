/*
  Warnings:

  - You are about to drop the column `lesson` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `levelId` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `Attendance` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[code]` on the table `AccessCode` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[student,group,date]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `group` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `student` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Level` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Test` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING', 'PARTIAL', 'OVERDUE');

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_levelId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_studentId_fkey";

-- AlterTable
ALTER TABLE "Advertisement" ADD COLUMN     "mediaType" "AdMediaType";

-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "lesson",
DROP COLUMN "levelId",
DROP COLUMN "studentId",
ADD COLUMN     "group" TEXT NOT NULL,
ADD COLUMN     "student" TEXT NOT NULL,
ALTER COLUMN "date" SET DATA TYPE DATE;

-- AlterTableALTER TABLE "Level" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "schedule" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "student" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "month" DATE NOT NULL,
    "paidAt" TIMESTAMP(3),
    "extra" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE INDEX "Group_levelId_idx" ON "Group"("levelId");

-- CreateIndex
CREATE INDEX "Group_isActive_idx" ON "Group"("isActive");

-- CreateIndex
CREATE INDEX "Payment_student_idx" ON "Payment"("student");

-- CreateIndex
CREATE INDEX "Payment_group_idx" ON "Payment"("group");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_month_idx" ON "Payment"("month");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_student_group_month_key" ON "Payment"("student", "group", "month");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCode_code_key" ON "AccessCode"("code");

-- CreateIndex
CREATE INDEX "AccessCode_expiresAt_idx" ON "AccessCode"("expiresAt");

-- CreateIndex
CREATE INDEX "Advertisement_isActive_idx" ON "Advertisement"("isActive");

-- CreateIndex
CREATE INDEX "Advertisement_createdBy_idx" ON "Advertisement"("createdBy");

-- CreateIndex
CREATE INDEX "Attendance_student_idx" ON "Attendance"("student");

-- CreateIndex
CREATE INDEX "Attendance_group_idx" ON "Attendance"("group");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE INDEX "Attendance_present_idx" ON "Attendance"("present");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_student_group_date_key" ON "Attendance"("student", "group", "date");

-- CreateIndex
CREATE INDEX "Test_levelId_idx" ON "Test"("levelId");

-- CreateIndex
CREATE INDEX "TestResult_userId_idx" ON "TestResult"("userId");

-- CreateIndex
CREATE INDEX "TestResult_levelId_idx" ON "TestResult"("levelId");

-- CreateIndex
CREATE INDEX "TestResult_createdAt_idx" ON "TestResult"("createdAt");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;
