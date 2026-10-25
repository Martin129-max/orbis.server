import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Theme } from '../../../prisma/generated/client';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(Object.values(Theme))
  theme?: Theme;

  @IsOptional()
  @IsBoolean()
  appearOffline?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
