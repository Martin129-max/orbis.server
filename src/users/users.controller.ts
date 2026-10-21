import {
  Controller,
  Get,
  Body,
  Patch,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Profile, UsersService } from './users.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PresenceGateway } from '../friends/presence.gateway';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly presence: PresenceGateway,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findProfile(@Req() req): Promise<Profile> {
    const profile = await this.usersService.findProfile(req.user.userId);
    if (!profile) throw new UnauthorizedException();
    return profile;
  }

  @Patch('me/preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(
    @Req() req,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ): Promise<Profile> {
    const profile = await this.usersService.updatePreferences(
      req.user.userId,
      updatePreferencesDto,
    );

    if (updatePreferencesDto.appearOffline !== undefined) {
      await this.presence.broadcastPresence(req.user.userId);
    }

    return profile;
  }
}
