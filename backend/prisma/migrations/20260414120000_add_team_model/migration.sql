-- CreateTable: Team
CREATE TABLE "Team" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "category"   TEXT,
  "inviteCode" TEXT NOT NULL,
  "coachId"    TEXT NOT NULL,
  "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Team_coachId_key"    UNIQUE ("coachId"),
  CONSTRAINT "Team_inviteCode_key" UNIQUE ("inviteCode"),
  CONSTRAINT "Team_coachId_fkey"   FOREIGN KEY ("coachId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AlterTable: add teamId to User
ALTER TABLE "User" ADD COLUMN "teamId" TEXT REFERENCES "Team"("id");
