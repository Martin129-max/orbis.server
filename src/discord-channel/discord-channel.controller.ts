import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { MINUTE, RateLimit } from '../common/throttle';
import { DiscordChannelService } from './discord-channel.service';
import { UpdateDiscordChannelDto } from './dto/update-discord-channel.dto';

@Controller('communities/:communityId/discord-channel')
@UseGuards(JwtAuthGuard, CommunityMemberGuard)
export class DiscordChannelController {
  constructor(private readonly discordChannel: DiscordChannelService) {}

  @Get()
  async find(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
  ) {
    return {
      channel: await this.discordChannel.find(req.user.userId, communityId),
    };
  }

  @RateLimit(30, MINUTE)
  @Patch()
  async update(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() settings: UpdateDiscordChannelDto,
  ) {
    return {
      channel: await this.discordChannel.update(
        req.user.userId,
        communityId,
        settings,
      ),
    };
  }

  @Delete()
  @HttpCode(204)
  disconnect(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<void> {
    return this.discordChannel.disconnect(req.user.userId, communityId);
  }
}
