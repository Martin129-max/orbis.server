import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PresenceGateway } from './presence.gateway';
import { PrismaService } from '../prisma.service';
import { SteamPlayingService } from './steam-playing.service';
import { TwitchLiveService } from './twitch-live.service';

@Module({
  imports: [JwtModule.register({ secret: process.env.JWT_SECRET })],
  providers: [
    PresenceGateway,
    TwitchLiveService,
    SteamPlayingService,
    PrismaService,
  ],
  exports: [PresenceGateway, TwitchLiveService],
})
export class PresenceModule {}
