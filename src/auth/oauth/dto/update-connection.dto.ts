import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateConnectionDto {
  @IsOptional()
  @IsBoolean()
  showLive?: boolean;

  @IsOptional()
  @IsBoolean()
  showClips?: boolean;
}
