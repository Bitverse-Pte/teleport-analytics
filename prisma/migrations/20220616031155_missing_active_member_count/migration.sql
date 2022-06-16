/*
  Warnings:

  - Added the required column `activeMemberCount` to the `TelegramGroupStats` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TelegramGroupStats` ADD COLUMN `activeMemberCount` INTEGER NOT NULL;
