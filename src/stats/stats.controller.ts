import { Controller, Get } from '@nestjs/common';
import { Stats, StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  summary(): Promise<Stats> {
    return this.statsService.summary();
  }
}
