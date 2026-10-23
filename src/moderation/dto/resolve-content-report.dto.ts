import { IsIn, IsInt, Max, Min } from 'class-validator';
import {
  ContentReportResolution,
  ContentReportTarget,
} from '../../../prisma/generated/client';

export class ResolveContentReportDto {
  @IsIn(Object.values(ContentReportTarget))
  type: ContentReportTarget;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  id: number;

  @IsIn(Object.values(ContentReportResolution))
  resolution: ContentReportResolution;
}
