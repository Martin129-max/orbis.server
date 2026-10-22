import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ReportCategory } from '../../../prisma/generated/client';

export class CreateReportDto {
  @IsIn(Object.values(ReportCategory))
  category: ReportCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageUrl?: string;
}
