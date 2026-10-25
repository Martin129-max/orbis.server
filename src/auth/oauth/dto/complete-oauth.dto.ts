import { IsString, MaxLength } from 'class-validator';

export class CompleteOAuthDto {
  @IsString()
  @MaxLength(1024)
  code: string;

  @IsString()
  @MaxLength(2048)
  state: string;

  @IsString()
  @MaxLength(128)
  nonce: string;
}
