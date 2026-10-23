import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReportStatus } from '../../../prisma/generated/client';

export class UpdateReportDto {
  @IsIn(Object.values(ReportStatus))
  status: ReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
