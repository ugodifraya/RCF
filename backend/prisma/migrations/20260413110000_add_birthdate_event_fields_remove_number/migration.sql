-- AlterTable: remove number, add birthDate to User
ALTER TABLE "User" ADD COLUMN "birthDate" DATETIME;

-- SQLite doesn't support DROP COLUMN in older versions, use a workaround
-- We'll just leave the number column (it won't appear in Prisma queries since it's removed from schema)
-- For SQLite we create a new table approach via Prisma

-- AlterTable: add new fields to Event
ALTER TABLE "Event" ADD COLUMN "subtype" TEXT;
ALTER TABLE "Event" ADD COLUMN "meetingTime" DATETIME;
ALTER TABLE "Event" ADD COLUMN "opponent" TEXT;
ALTER TABLE "Event" ADD COLUMN "roundNumber" TEXT;
ALTER TABLE "Event" ADD COLUMN "notifyOnCreate" BOOLEAN NOT NULL DEFAULT 1;
