import { Module } from '@nestjs/common'
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CommunitiesModule } from './communities/communities.module';
import { PostsModule } from './posts/posts.module';
import { AppController } from './app.controller'
import { AppService } from './app.service';
import { PrismaService } from './prisma.service'

@Module({
  imports: [UsersModule, AuthModule, CommunitiesModule, PostsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
