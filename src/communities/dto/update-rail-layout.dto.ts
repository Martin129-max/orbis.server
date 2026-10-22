import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class RailFolderDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string;

  @IsOptional()
  @Matches(/^#[0-9a-f]{6}$/i)
  color?: string;

  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  communityIds: number[];
}

export class RailItemDto {
  @IsOptional()
  @IsInt()
  communityId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RailFolderDto)
  folder?: RailFolderDto;
}

export class UpdateRailLayoutDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => RailItemDto)
  items: RailItemDto[];
}
