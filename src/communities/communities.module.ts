import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityMemberGuard } from './community-member.guard';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [CommunitiesController],
  providers: [CommunitiesService, CommunityMemberGuard, PrismaService],
})
export class CommunitiesModule {}
