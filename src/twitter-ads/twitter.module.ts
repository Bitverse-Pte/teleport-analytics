import { Module } from '@nestjs/common';
import {PrismaModule} from "../prisma/prisma.module";
import {TwitterService} from "./twitter.service";


@Module({
    imports: [PrismaModule],
    providers: [TwitterService]
})
export class TwitterModule {}
