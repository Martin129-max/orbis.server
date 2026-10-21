import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SearchCommunitiesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
