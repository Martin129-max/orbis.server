import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { SiteAdminGuard } from '../admin/site-admin.guard';
import { PrismaService } from '../prisma.service';
import { ReportsModule } from '../reports/reports.module';
import { DiscordChannelModule } from '../discord-channel/discord-channel.module';

@Module({
  imports: [ReportsModule, DiscordChannelModule],
  controllers: [ModerationController],
  providers: [ModerationService, SiteAdminGuard, PrismaService],
})
export class ModerationModule {}
