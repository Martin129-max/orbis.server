import { IsIn, IsInt, Max, Min } from 'class-validator';
import { VotableType } from '../../../prisma/generated/client';

export class VoteDto {
  @IsIn(Object.values(VotableType))
  type: VotableType;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  id: number;

  @IsIn([-1, 0, 1])
  value: number;
}
