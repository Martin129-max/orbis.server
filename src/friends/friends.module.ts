import { Module } from '@nestjs/common';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PresenceModule } from './presence.module';
import { PrismaService } from '../prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PresenceModule, NotificationsModule],
  controllers: [FriendsController],
  providers: [FriendsService, PrismaService],
  exports: [PresenceModule],
})
export class FriendsModule {}
