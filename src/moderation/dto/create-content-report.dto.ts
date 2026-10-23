import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ContentReportReason,
  ContentReportTarget,
} from '../../../prisma/generated/client';

export class CreateContentReportDto {
  @IsIn(Object.values(ContentReportTarget))
  type: ContentReportTarget;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  id: number;

  @IsIn(Object.values(ContentReportReason))
  reason: ContentReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
