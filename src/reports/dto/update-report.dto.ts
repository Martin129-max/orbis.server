import { IsIn } from 'class-validator';
import { ReportStatus } from '../../../prisma/generated/client';

export class UpdateReportDto {
  @IsIn(Object.values(ReportStatus))
  status: ReportStatus;
}
