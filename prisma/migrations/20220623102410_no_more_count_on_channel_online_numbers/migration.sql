/*
  Warnings:

  - You are about to drop the column `endOnlineMemberCount` on the `DiscordGuildChannelDailyStat` table. All the data in the column will be lost.
  - You are about to drop the column `startOnlineMemberCount` on the `DiscordGuildChannelDailyStat` table. All the data in the column will be lost.
  - You are about to drop the column `onlineMemberCount` on the `DiscordGuildChannelStat` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `DiscordGuildChannelDailyStat` DROP COLUMN `endOnlineMemberCount`,
    DROP COLUMN `startOnlineMemberCount`;

-- AlterTable
ALTER TABLE `DiscordGuildChannelStat` DROP COLUMN `onlineMemberCount`;
