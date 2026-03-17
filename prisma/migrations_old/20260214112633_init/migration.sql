/*
  Warnings:

  - You are about to drop the column `endTime` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Level` table. All the data in the column will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Payment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PaymentSchedule` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `lesson` to the `Attendance` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Group" DROP CONSTRAINT "Group_levelId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_groupId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_paymentScheduleId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_studentId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentSchedule" DROP CONSTRAINT "PaymentSchedule_studentId_fkey";

-- DropIndex
DROP INDEX "Attendance_groupId_date_idx";

-- DropIndex
DROP INDEX "Attendance_studentId_date_idx";

-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "endTime",
DROP COLUMN "groupId",
DROP COLUMN "startTime",
ADD COLUMN     "lesson" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Level" DROP COLUMN "createdAt";

-- DropTable
DROP TABLE "Group";

-- DropTable
DROP TABLE "GroupMember";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "PaymentSchedule";

-- DropEnum
DROP TYPE "PaymentStatus";
