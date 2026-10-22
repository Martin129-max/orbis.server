import { Module } from '@nestjs/common';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';
import { CommunityMemberGuard } from './community-member.guard';
import { PrismaService } from '../prisma.service';
import { StorageModule } from '../storage/storage.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [StorageModule, FriendsModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService, CommunityMemberGuard, PrismaService],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
