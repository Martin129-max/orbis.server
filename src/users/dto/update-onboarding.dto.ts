import { IsBoolean, IsOptional, Matches } from 'class-validator';

export class UpdateOnboardingDto {
  @IsOptional()
  @IsBoolean()
  tourCompleted?: boolean;

  @IsOptional()
  @IsBoolean()
  checklistDismissed?: boolean;

  @IsOptional()
  @Matches(/^[a-z][a-z-]{0,39}$/)
  completedTour?: string;

  @IsOptional()
  @IsBoolean()
  resetTours?: boolean;
}
