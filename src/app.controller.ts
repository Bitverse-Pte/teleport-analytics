import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import * as moment from 'moment'
import { UptimeService } from './uptime/uptime.service';
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly uptimeService: UptimeService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/metrics')
  iAmStillAlive() {
    const uptime = this.uptimeService.getUptime();
    return { message: 'Still alive', uptime };
  }

  @Get('/getReportData')
  async getReportData() {
    const result = await this.appService.getReportData();
    return { result }
  }

  @Post('/sendReport')
  async triggerSendReport() {
    await this.appService.sendReport();
    return 'OK';
  }

  @Post('/writeCurrentPlatformStats')
 async getCurrentPlatformStats() {
   await this.appService.getCurrentPlatformStats()
   return 'OK'
 }
}
