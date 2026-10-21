import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityMemberGuard } from './community-member.guard';
import { PrismaService } from '../prisma.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService, CommunityMemberGuard, PrismaService],
})
export class CommunitiesModule {}
