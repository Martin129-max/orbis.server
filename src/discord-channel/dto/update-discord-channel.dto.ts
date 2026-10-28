import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateDiscordChannelDto {
  @IsOptional()
  @IsBoolean()
  sendPosts?: boolean;

  @IsOptional()
  @IsBoolean()
  sendThreads?: boolean;

  @IsOptional()
  @IsBoolean()
  sendLibrary?: boolean;
}
