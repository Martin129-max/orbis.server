import {
  Controller,
  Get,
  Body,
  Patch,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Profile, UsersService } from './users.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PresenceGateway } from '../friends/presence.gateway';
import { IMAGE_MAX_BYTES } from '../storage/storage.service';

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

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_MAX_BYTES } }),
  )
  uploadAvatar(
    @Req() req,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<Profile> {
    if (!file) throw new BadRequestException('Choose an image to upload');
    return this.usersService.updateAvatar(req.user.userId, file.buffer);
  }

  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  removeAvatar(@Req() req): Promise<Profile> {
    return this.usersService.removeAvatar(req.user.userId);
  }
}
