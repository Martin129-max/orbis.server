import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Profile, PublicUser, UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
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

  @Post('signup')
  async create(@Body() createUserDto: CreateUserDto): Promise<PublicUser> {
    return this.usersService.create(createUserDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PublicUser | null> {
    return this.usersService.findOne(Number(id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<PublicUser> {
    return this.usersService.update(Number(id), updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<PublicUser> {
    return this.usersService.remove(Number(id));
  }
}
