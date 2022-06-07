-- CreateTable
CREATE TABLE `TwitterAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `TwitterAccount_accountId_key`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TwitterAccountRealTimeStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `twitterAccountId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `followersCount` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TwitterAccountDailyStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `twitterAccountId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `followersCount` INTEGER NOT NULL,
    `newFollowersCount` INTEGER NOT NULL,
    `tweetCount` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tweet` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tweetId` VARCHAR(191) NOT NULL,
    `twitterAccountId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL,
    `text` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TweetsDailyStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tweetsCount` INTEGER NOT NULL,
    `impressions` INTEGER NOT NULL,
    `retweets` INTEGER NOT NULL,
    `quoteTweets` INTEGER NOT NULL,
    `likes` INTEGER NOT NULL,
    `Replies` INTEGER NOT NULL,
    `urlLinkClicks` INTEGER NOT NULL,
    `userProfileClicks` INTEGER NOT NULL,
    `videoViews` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TweetRealTimeStat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tweetID` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `impressions` INTEGER NOT NULL,
    `retweets` INTEGER NOT NULL,
    `quoteTweets` INTEGER NOT NULL,
    `likes` INTEGER NOT NULL,
    `Replies` INTEGER NOT NULL,
    `urlLinkClicks` INTEGER NOT NULL,
    `userProfileClicks` INTEGER NOT NULL,
    `videoViews` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
