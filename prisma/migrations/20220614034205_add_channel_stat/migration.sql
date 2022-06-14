-- CreateTable
CREATE TABLE `DiscordGuildChannelStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `discordChannelId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `totalMemberCount` INTEGER NOT NULL DEFAULT 0,
    `onlineMemberCount` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DiscordGuildChannelStat` ADD CONSTRAINT `DiscordGuildChannelStat_discordChannelId_fkey` FOREIGN KEY (`discordChannelId`) REFERENCES `DiscordChannel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
