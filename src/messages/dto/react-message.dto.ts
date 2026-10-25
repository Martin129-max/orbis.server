import { IsIn } from 'class-validator';
import { MESSAGE_REACTIONS } from '../conversation';

export class ReactMessageDto {
  @IsIn(MESSAGE_REACTIONS)
  emoji: string;
}
