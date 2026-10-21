import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PostsController, FeedController],
  providers: [PostsService, CommunityMemberGuard, PrismaService],
})
export class PostsModule {}
