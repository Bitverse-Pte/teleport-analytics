import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { CombotAnalyticResult } from './typing/Combot';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async getTelegramGroupStatFromCombot(groupId: string) {
    const response = await axios.get<CombotAnalyticResult>(`https://combot.org/c/${groupId}/a/json`, {
      headers: {
        Cookie: process.env.COMBOT_COOKIES_STR
      }
    });
    console.info('response', response);
  }
}
