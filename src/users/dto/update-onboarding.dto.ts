import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsBoolean()
  tourCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  checklistDismissed?: boolean;
}
