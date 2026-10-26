import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PresenceModule } from '../friends/presence.module';
import { LibraryModule } from '../library/library.module';
import { PrismaService } from '../prisma.service';
import { SteamController } from './steam.controller';
import { SteamService } from './steam.service';

@Module({
  imports: [LibraryModule, PresenceModule, JwtModule.register({})],
  controllers: [SteamController],
  providers: [SteamService, PrismaService],
})
export class SteamModule {}
