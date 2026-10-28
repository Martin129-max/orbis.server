import { IsString, Matches, MaxLength } from 'class-validator';

export class ConnectDiscordServerDto {
  @IsString()
  @MaxLength(16384)
  token: string;

  @IsString()
  @Matches(/^\d{1,20}$/, { message: 'serverId must be a Discord server ID' })
  serverId: string;
}
