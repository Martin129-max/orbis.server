import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSteamDto {
  @IsOptional()
  @IsBoolean()
  trackGames?: boolean;

  @IsOptional()
  @IsBoolean()
  showPlaying?: boolean;
}
