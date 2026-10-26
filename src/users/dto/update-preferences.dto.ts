import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { Theme, UserStatus } from '../../../prisma/generated/client';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(Object.values(Theme))
  theme?: Theme;

  @IsOptional()
  @IsBoolean()
  appearOffline?: boolean;

  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  showNsfw?: boolean;
}
