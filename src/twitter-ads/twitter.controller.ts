import {Controller, Get, Query} from "@nestjs/common";
import { TwitterService } from "./twitter.service";

@Controller('/twitter')
export class TwitterController {
    constructor(private readonly twitterService: TwitterService) {}

    @Get('/setAccount')
    async setAccount(@Query('name') name) {
        await this.twitterService.apiSetAccount(name)
        return
    }
}
