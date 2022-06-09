/*
  Warnings:

  - Added the required column `createdAt` to the `DiscordChannel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `DiscordChannel` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `DiscordChannel` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `DiscordChannel` ADD COLUMN `createdAt` DATETIME(3) NOT NULL,
    ADD COLUMN `name` VARCHAR(191) NOT NULL,
    ADD COLUMN `type` ENUM('GUILD_TEXT', 'DM', 'GUILD_VOICE', 'GROUP_DM', 'GUILD_CATEGORY', 'GUILD_NEWS', 'GUILD_STORE', 'UNUSED1', 'UNUSED2', 'UNUSED3', 'GUILD_NEWS_THREAD', 'GUILD_PUBLIC_THREAD', 'GUILD_PRIVATE_THREAD', 'GUILD_STAGE_VOICE', 'GUILD_DIRECTORY') NOT NULL;
