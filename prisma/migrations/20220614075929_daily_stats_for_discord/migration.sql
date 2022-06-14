-- CreateTable
CREATE TABLE `DiscordGuildDailyStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startTotalMemberCount` INTEGER NOT NULL DEFAULT 0,
    `startOnlineMemberCount` INTEGER NOT NULL DEFAULT 0,
    `endTotalMemberCount` INTEGER NOT NULL DEFAULT 0,
    `endOnlineMemberCount` INTEGER NOT NULL DEFAULT 0,
    `highestOnlineMemberCount` INTEGER NOT NULL DEFAULT 0,
    `lowestOnlineMemberCount` INTEGER NOT NULL DEFAULT 0,
    `discordGuildId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscordGuildChannelDailyStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startTotalMemberCount` INTEGER NOT NULL DEFAULT 0,
    `startOnlineMemberCount` INTEGER NOT NULL DEFAULT 0,
    `endTotalMemberCount` INTEGER NOT NULL DEFAULT 0,
    `endOnlineMemberCount` INTEGER NOT NULL DEFAULT 0,
    `highestTotalMemberCount` INTEGER NOT NULL DEFAULT 0,
    `lowestTotalMemberCount` INTEGER NOT NULL DEFAULT 0,
    `discordChannelId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DiscordGuildDailyStat` ADD CONSTRAINT `DiscordGuildDailyStat_discordGuildId_fkey` FOREIGN KEY (`discordGuildId`) REFERENCES `DiscordGuild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscordGuildChannelDailyStat` ADD CONSTRAINT `DiscordGuildChannelDailyStat_discordChannelId_fkey` FOREIGN KEY (`discordChannelId`) REFERENCES `DiscordChannel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
