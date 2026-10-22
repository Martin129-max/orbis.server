import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CommunitiesModule } from './communities/communities.module';
import { PostsModule } from './posts/posts.module';
import { FriendsModule } from './friends/friends.module';
import { ThreadsModule } from './threads/threads.module';
import { CommentsModule } from './comments/comments.module';
import { VotesModule } from './votes/votes.module';
import { LikesModule } from './likes/likes.module';
import { StatsModule } from './stats/stats.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LibraryModule } from './library/library.module';
import { InvitesModule } from './invites/invites.module';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    CommunitiesModule,
    PostsModule,
    FriendsModule,
    ThreadsModule,
    CommentsModule,
    VotesModule,
    LikesModule,
    StatsModule,
    ReportsModule,
    NotificationsModule,
    LibraryModule,
    InvitesModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
