import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { PresenceGateway } from './presence.gateway';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  controllers: [FriendsController],
  providers: [FriendsService, PresenceGateway, PrismaService],
  exports: [PresenceGateway],
})
export class FriendsModule {}
