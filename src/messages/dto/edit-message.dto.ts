import { IsString, MaxLength } from 'class-validator';
import { MESSAGE_MAX_LENGTH } from '../conversation';

export class EditMessageDto {
  @IsString()
  @MaxLength(MESSAGE_MAX_LENGTH)
  text: string;
}
