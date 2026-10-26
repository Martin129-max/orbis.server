import { IsObject, IsString, MaxLength } from 'class-validator';

export class ConnectSteamDto {
  @IsString()
  @MaxLength(2048)
  state: string;

  @IsString()
  @MaxLength(128)
  nonce: string;

  @IsObject()
  params: Record<string, string>;
}
