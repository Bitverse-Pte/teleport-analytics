import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import * as moment from 'moment'
@Controller()
export class AppController {
  private readonly appLaunchedAt = Date.now();
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/metrics')
  iAmStillAlive() {
    const msThatLasted = Date.now() - this.appLaunchedAt;
    const uptime = {
      appLaunchedAt: moment(this.appLaunchedAt).toLocaleString(),
      ms: msThatLasted,
      timeFromNow: moment(this.appLaunchedAt).fromNow()
    }
    return { message: 'Still alive', uptime };
  }
}
