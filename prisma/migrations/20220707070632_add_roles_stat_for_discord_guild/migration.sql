-- CreateTable
CREATE TABLE `DiscordGuildRolesStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `discordGuildId` VARCHAR(191) NOT NULL,
    `unicodeEmoji` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DiscordGuildRolesStat` ADD CONSTRAINT `DiscordGuildRolesStat_discordGuildId_fkey` FOREIGN KEY (`discordGuildId`) REFERENCES `DiscordGuild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
