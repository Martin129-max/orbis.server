import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { PrismaService } from '../prisma.service';
import { ThreadsModule } from '../threads/threads.module';

@Module({
  imports: [ThreadsModule],
  controllers: [PostsController, FeedController],
  providers: [PostsService, CommunityMemberGuard, PrismaService],
})
export class PostsModule {}
