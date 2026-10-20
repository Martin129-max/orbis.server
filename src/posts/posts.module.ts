import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, CommunityMemberGuard, PrismaService],
})
export class PostsModule {}
