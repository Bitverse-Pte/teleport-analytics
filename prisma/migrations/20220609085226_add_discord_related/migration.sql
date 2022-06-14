-- CreateTable
CREATE TABLE `DiscordGuild` (
    `id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscordGuildMember` (
    `id` VARCHAR(191) NOT NULL,
    `discordGuildId` VARCHAR(191) NOT NULL,
    `messageQty` INTEGER NOT NULL,
    `lastSeen` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DiscordChannel` (
    `id` VARCHAR(191) NOT NULL,
    `discordGuildId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DiscordGuildMember` ADD CONSTRAINT `DiscordGuildMember_discordGuildId_fkey` FOREIGN KEY (`discordGuildId`) REFERENCES `DiscordGuild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DiscordChannel` ADD CONSTRAINT `DiscordChannel_discordGuildId_fkey` FOREIGN KEY (`discordGuildId`) REFERENCES `DiscordGuild`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
