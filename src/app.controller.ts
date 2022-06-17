import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import * as moment from 'moment'
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/metrics')
  iAmStillAlive() {
    const uptime = this.appService.getUptime();
    return { message: 'Still alive', uptime };
  }

  @Get('/getReportData')
  async getReportData() {
    const result = await this.appService.getReportData();
    return { result }
  }
}
