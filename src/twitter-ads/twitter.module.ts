import { Module } from '@nestjs/common';
import {PrismaModule} from "../prisma/prisma.module";
import {TwitterService} from "./twitter.service";
import {TwitterController} from "./twitter.controller";
import {EmailModule} from "../email/email.module";

@Module({
    imports: [PrismaModule, EmailModule],
    controllers: [TwitterController],
    providers: [TwitterService],
    exports: [TwitterService]
})
export class TwitterModule {}
