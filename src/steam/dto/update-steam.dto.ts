import { IsBoolean } from 'class-validator';

export class UpdateSteamDto {
  @IsBoolean()
  trackGames: boolean;
}
