import { Module } from '@nestjs/common';
import { CommunitiesModule } from '../communities/communities.module';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { PrismaService } from '../prisma.service';
import { DiscordChannelController } from './discord-channel.controller';
import { DiscordChannelService } from './discord-channel.service';

@Module({
  imports: [CommunitiesModule],
  controllers: [DiscordChannelController],
  providers: [DiscordChannelService, CommunityMemberGuard, PrismaService],
  exports: [DiscordChannelService],
})
export class DiscordChannelModule {}
