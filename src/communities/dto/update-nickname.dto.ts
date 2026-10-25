import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateNicknameDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  nickname?: string | null;
}
