import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

type FeatureFlag = 'TELEGRAM_GROUP_DAILY_STAT' | 'DISCORD_SERVER_DAILY_STAT'

@Injectable()
export class FailSafeIndicatorService {
    constructor(private readonly prisma: PrismaService) {
    }

    async setIndicator(key: FeatureFlag, value: boolean) {
        return this.prisma.lockMap.upsert({
            where: {
                name: key
            },
            update: {
                value
            },
            create: {
                name: key,
                value
            }
        })
    }

    async getIndicator(key: FeatureFlag): Promise<boolean> {
        const indicator = await this.prisma.lockMap.findUnique({
            where: { name: key }
        });
        return indicator.value;
    }

    async getUpdatedAt(key: FeatureFlag): Promise<string> {
        const indicator = await this.prisma.lockMap.findUnique({
            where: { name: key }
        });
        return indicator.updatedAt.toString();
    }
}
