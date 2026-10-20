import { IsIn } from 'class-validator';
import { Theme } from '../../../prisma/generated/client';

export class UpdatePreferencesDto {
  @IsIn(Object.values(Theme))
  theme: Theme;
}
