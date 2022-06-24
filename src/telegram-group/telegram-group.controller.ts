import { Controller, Get, Post, Put } from '@nestjs/common';
import { TelegramGroupService } from './telegram-group.service';

@Controller('telegram-group')
export class TelegramGroupController {
    constructor(
        private readonly telegramService: TelegramGroupService
    ){}
    @Post('/stop')
    async stopTelegramBotFromListening(){
        this.telegramService.stopListening();
        return 'OK';
    }
    @Get('/group')
    async getGroupChats () {
        const result = await this.telegramService.getListeningGroups();
        return { result };
    }
    @Put('/group')
    async updateTelegramChatsProfile () {
        await this.telegramService.updateTelegramChatsProfile();
        return "OK";
    }
}
