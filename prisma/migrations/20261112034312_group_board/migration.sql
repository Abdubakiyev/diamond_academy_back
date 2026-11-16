-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "diamond" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GroupFee" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupFee_groupId_idx" ON "GroupFee"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupFee_groupId_month_key" ON "GroupFee"("groupId", "month");

-- AddForeignKey
ALTER TABLE "GroupFee" ADD CONSTRAINT "GroupFee_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
