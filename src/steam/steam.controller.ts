import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MINUTE, RateLimit } from '../common/throttle';
import { ConnectSteamDto } from './dto/connect-steam.dto';
import { UpdateSteamDto } from './dto/update-steam.dto';
import { SteamService, SteamStatus } from './steam.service';

@Controller('steam')
@UseGuards(JwtAuthGuard)
export class SteamController {
  constructor(private readonly steam: SteamService) {}

  @Get()
  status(@Req() req): Promise<SteamStatus> {
    return this.steam.status(req.user.userId);
  }

  @RateLimit(30, MINUTE)
  @Get('connect-url')
  connectUrl(@Req() req, @Query('nonce') nonce = '') {
    return { url: this.steam.connectUrl(req.user.userId, nonce) };
  }

  @RateLimit(10, MINUTE)
  @Post('connect')
  connect(@Req() req, @Body() body: ConnectSteamDto): Promise<SteamStatus> {
    return this.steam.connect(req.user.userId, body);
  }

  @RateLimit(30, MINUTE)
  @Patch()
  update(
    @Req() req,
    @Body() { trackGames }: UpdateSteamDto,
  ): Promise<SteamStatus> {
    return this.steam.setTrackGames(req.user.userId, trackGames);
  }

  @Delete()
  @HttpCode(204)
  disconnect(@Req() req): Promise<void> {
    return this.steam.disconnect(req.user.userId);
  }
}
