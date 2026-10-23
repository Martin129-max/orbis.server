import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { ResolveContentReportDto } from './dto/resolve-content-report.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SiteAdminGuard } from '../admin/site-admin.guard';
import { HOUR, RateLimit } from '../common/throttle';

@Controller('content-reports')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post()
  @RateLimit(10, HOUR)
  @HttpCode(204)
  create(@Req() req, @Body() dto: CreateContentReportDto): Promise<void> {
    return this.moderationService.create(req.user.userId, dto);
  }

  @Get()
  @UseGuards(SiteAdminGuard)
  open() {
    return this.moderationService.open();
  }

  @Put('resolution')
  @UseGuards(SiteAdminGuard)
  @HttpCode(204)
  resolve(@Req() req, @Body() dto: ResolveContentReportDto): Promise<void> {
    return this.moderationService.resolve(req.user.userId, dto);
  }
}
