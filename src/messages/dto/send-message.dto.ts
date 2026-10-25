import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MAX_INT } from '../../communities/community-member.guard';
import { MESSAGE_MAX_LENGTH } from '../conversation';

export class SendMessageDto {
  @IsString()
  @MaxLength(MESSAGE_MAX_LENGTH)
  text: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_INT)
  replyToId?: number;
}
