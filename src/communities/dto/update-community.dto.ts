import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateCommunityDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/\S/, { message: 'name must not be blank' })
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
