import { Module } from '@nestjs/common';
import {
  CommunityThreadsController,
  ThreadsController,
} from './threads.controller';
import { ThreadsService } from './threads.service';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { PrismaService } from '../prisma.service';
import { VotesModule } from '../votes/votes.module';

@Module({
  imports: [VotesModule],
  controllers: [CommunityThreadsController, ThreadsController],
  providers: [ThreadsService, CommunityMemberGuard, PrismaService],
  exports: [ThreadsService],
})
export class ThreadsModule {}
