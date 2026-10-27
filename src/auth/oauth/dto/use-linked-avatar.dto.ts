import { IsString, MaxLength } from 'class-validator';

export class UseLinkedAvatarDto {
  @IsString()
  @MaxLength(2048)
  token: string;
}
