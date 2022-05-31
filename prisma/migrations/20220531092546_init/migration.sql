-- CreateTable
CREATE TABLE "TelegramGroupDailyStat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupId" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "newMemberCount" INTEGER NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "activeMemberCount" INTEGER NOT NULL,
    "totalMemberCount" INTEGER NOT NULL
);
