-- CreateTable
CREATE TABLE `_DiscordChannelToDiscordGuildMember` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_DiscordChannelToDiscordGuildMember_AB_unique`(`A`, `B`),
    INDEX `_DiscordChannelToDiscordGuildMember_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_DiscordChannelToDiscordGuildMember` ADD CONSTRAINT `_DiscordChannelToDiscordGuildMember_A_fkey` FOREIGN KEY (`A`) REFERENCES `DiscordChannel`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_DiscordChannelToDiscordGuildMember` ADD CONSTRAINT `_DiscordChannelToDiscordGuildMember_B_fkey` FOREIGN KEY (`B`) REFERENCES `DiscordGuildMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
