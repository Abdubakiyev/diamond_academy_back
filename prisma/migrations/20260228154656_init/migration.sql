/*
  Warnings:

  - You are about to drop the column `group` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `student` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `group` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `student` on the `Payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[studentId,groupId,date]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[studentId,groupId,month]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `groupId` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `groupId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `studentId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Attendance_group_idx";

-- DropIndex
DROP INDEX "Attendance_student_group_date_key";

-- DropIndex
DROP INDEX "Attendance_student_idx";

-- DropIndex
DROP INDEX "Payment_group_idx";

-- DropIndex
DROP INDEX "Payment_student_group_month_key";

-- DropIndex
DROP INDEX "Payment_student_idx";

-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "group",
DROP COLUMN "student",
ADD COLUMN     "groupId" TEXT NOT NULL,
ADD COLUMN     "studentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "group",
DROP COLUMN "student",
ADD COLUMN     "groupId" TEXT NOT NULL,
ADD COLUMN     "studentId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "groupId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Student_groupId_idx" ON "Student"("groupId");

-- CreateIndex
CREATE INDEX "Student_isActive_idx" ON "Student"("isActive");

-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");

-- CreateIndex
CREATE INDEX "Attendance_groupId_idx" ON "Attendance"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_studentId_groupId_date_key" ON "Attendance"("studentId", "groupId", "date");

-- CreateIndex
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");

-- CreateIndex
CREATE INDEX "Payment_groupId_idx" ON "Payment"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_studentId_groupId_month_key" ON "Payment"("studentId", "groupId", "month");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
