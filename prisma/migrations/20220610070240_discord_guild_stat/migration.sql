-- CreateTable
CREATE TABLE `DiscordGuildStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `discordGuildId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `totalMemberCount` INTEGER NOT NULL DEFAULT 0,
    `onlineMemberCount` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DiscordGuildStat` ADD CONSTRAINT `DiscordGuildStat_discordGuildId_fkey` FOREIGN KEY (`discordGuildId`) REFERENCES `DiscordGuild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
