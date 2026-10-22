import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const INVITE_MAX_AGE = 30 * 24 * 60 * 60;
export const INVITE_MAX_USES = 100;

export class CreateInviteDto {
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(INVITE_MAX_AGE)
  maxAge?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(INVITE_MAX_USES)
  maxUses?: number | null;
}
