import { Controller, Post } from '@nestjs/common';
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
}
