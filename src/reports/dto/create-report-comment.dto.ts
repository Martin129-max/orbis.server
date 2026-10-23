import { IsString, MaxLength } from 'class-validator';

export class CreateReportCommentDto {
  @IsString()
  @MaxLength(2000)
  content: string;
}
