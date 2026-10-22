import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { PostsController } from './posts.controller';
import { UserPostsController } from './user-posts.controller';
import { PostsService } from './posts.service';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { PrismaService } from '../prisma.service';
import { ThreadsModule } from '../threads/threads.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ThreadsModule, NotificationsModule],
  controllers: [PostsController, FeedController, UserPostsController],
  providers: [PostsService, CommunityMemberGuard, PrismaService],
})
export class PostsModule {}
