import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AssignReportDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  assigneeId: number | null;
}
