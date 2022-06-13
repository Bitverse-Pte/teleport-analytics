/*
  Warnings:

  - You are about to drop the column `Replies` on the `TweetRealTimeStat` table. All the data in the column will be lost.
  - You are about to drop the column `tweetID` on the `TweetRealTimeStat` table. All the data in the column will be lost.
  - Added the required column `replies` to the `TweetRealTimeStat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tweetId` to the `TweetRealTimeStat` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `TweetRealTimeStat` DROP COLUMN `Replies`,
    DROP COLUMN `tweetID`,
    ADD COLUMN `replies` INTEGER NOT NULL,
    ADD COLUMN `tweetId` VARCHAR(191) NOT NULL;
