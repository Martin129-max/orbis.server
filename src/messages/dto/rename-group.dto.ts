import { IsString, MaxLength } from 'class-validator';
import { GROUP_NAME_MAX_LENGTH } from '../conversation';

export class RenameGroupDto {
  @IsString()
  @MaxLength(GROUP_NAME_MAX_LENGTH)
  name: string;
}
