import { Module } from '@nestjs/common';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { SiteAdminGuard } from '../admin/site-admin.guard';
import { PrismaService } from '../prisma.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  controllers: [ModerationController],
  providers: [ModerationService, SiteAdminGuard, PrismaService],
})
export class ModerationModule {}
