/*
  Warnings:

  - Added the required column `activeNewMemberCount` to the `TelegramGroupDailyStat` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TelegramGroupDailyStat` ADD COLUMN `activeNewMemberCount` INTEGER NOT NULL;
