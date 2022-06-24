import { Injectable } from '@nestjs/common';
import * as moment from "moment-timezone";

@Injectable()
export class UptimeService {
  private readonly appLaunchedAt = Date.now();

  getUptime() {
    const msThatLasted = Date.now() - this.appLaunchedAt;
    const uptime = {
      appLaunchedAt: moment(this.appLaunchedAt).toLocaleString(),
      ms: msThatLasted,
      timeFromNow: moment(this.appLaunchedAt).fromNow()
    }
    return uptime;
  }
}
