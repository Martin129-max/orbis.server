import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { GROUP_MAX_MEMBERS, GROUP_NAME_MAX_LENGTH } from '../conversation';

export class CreateGroupDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(GROUP_MAX_MEMBERS - 1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2147483647, { each: true })
  userIds: number[];

  @IsOptional()
  @IsString()
  @MaxLength(GROUP_NAME_MAX_LENGTH)
  name?: string;
}
