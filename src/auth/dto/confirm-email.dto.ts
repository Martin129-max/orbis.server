import { IsString, MaxLength } from 'class-validator';

export class ConfirmEmailDto {
  @IsString()
  @MaxLength(2048)
  token: string;
}
