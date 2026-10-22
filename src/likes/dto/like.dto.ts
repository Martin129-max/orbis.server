import { IsBoolean, IsIn, IsInt, Max, Min } from 'class-validator';
import { LikeableType } from '../../../prisma/generated/client';

export class LikeDto {
  @IsIn(Object.values(LikeableType))
  type: LikeableType;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  id: number;

  @IsBoolean()
  liked: boolean;
}
