import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { SiteAdminGuard } from './site-admin.guard';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, SiteAdminGuard, PrismaService],
})
export class AdminModule {}
