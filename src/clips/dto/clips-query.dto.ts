import { IsOptional, Matches, MaxLength } from 'class-validator';

export class ClipsQueryDto {
  @IsOptional()
  @MaxLength(512)
  @Matches(/^[\w+/=-]+$/)
  cursor?: string;
}
