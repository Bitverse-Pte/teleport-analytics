/*
  Warnings:

  - You are about to drop the column `Replies` on the `TweetsDailyStat` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[tweetId]` on the table `Tweet` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Tweet` ADD COLUMN `impressions` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `likes` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `quoteTweets` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `replies` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `retweets` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `urlLinkClicks` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `userProfileClicks` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `videoViews` INTEGER NOT NULL DEFAULT 0,
    MODIFY `twitterAccountId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `TweetRealTimeStat` MODIFY `impressions` INTEGER NOT NULL DEFAULT 0,
    MODIFY `retweets` INTEGER NOT NULL DEFAULT 0,
    MODIFY `quoteTweets` INTEGER NOT NULL DEFAULT 0,
    MODIFY `likes` INTEGER NOT NULL DEFAULT 0,
    MODIFY `urlLinkClicks` INTEGER NOT NULL DEFAULT 0,
    MODIFY `userProfileClicks` INTEGER NOT NULL DEFAULT 0,
    MODIFY `videoViews` INTEGER NOT NULL DEFAULT 0,
    MODIFY `replies` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `TweetsDailyStat` DROP COLUMN `Replies`,
    ADD COLUMN `replies` INTEGER NOT NULL DEFAULT 0,
    MODIFY `tweetsCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `impressions` INTEGER NOT NULL DEFAULT 0,
    MODIFY `retweets` INTEGER NOT NULL DEFAULT 0,
    MODIFY `quoteTweets` INTEGER NOT NULL DEFAULT 0,
    MODIFY `likes` INTEGER NOT NULL DEFAULT 0,
    MODIFY `urlLinkClicks` INTEGER NOT NULL DEFAULT 0,
    MODIFY `userProfileClicks` INTEGER NOT NULL DEFAULT 0,
    MODIFY `videoViews` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `TwitterAccount` ADD COLUMN `followersCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `tweetCount` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `TwitterAccountDailyStat` MODIFY `twitterAccountId` VARCHAR(191) NOT NULL,
    MODIFY `followersCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `newFollowersCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `tweetCount` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `TwitterAccountRealTimeStat` MODIFY `followersCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `followingCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `listedCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `tweetCount` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX `Tweet_tweetId_key` ON `Tweet`(`tweetId`);

-- CreateIndex
CREATE INDEX `Tweet_twitterAccountId_tweetId_idx` ON `Tweet`(`twitterAccountId`, `tweetId`);

-- CreateIndex
CREATE INDEX `TweetRealTimeStat_tweetId_idx` ON `TweetRealTimeStat`(`tweetId`);

-- CreateIndex
CREATE INDEX `TwitterAccountDailyStat_twitterAccountId_idx` ON `TwitterAccountDailyStat`(`twitterAccountId`);

-- CreateIndex
CREATE INDEX `TwitterAccountRealTimeStat_twitterAccountId_idx` ON `TwitterAccountRealTimeStat`(`twitterAccountId`);
