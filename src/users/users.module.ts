import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma.service';
import { FriendsModule } from '../friends/friends.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [FriendsModule, StorageModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
})
export class UsersModule {}
