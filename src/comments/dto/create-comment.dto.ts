import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CommentableType } from '../../../prisma/generated/client';

export class CreateCommentDto {
  @IsIn(Object.values(CommentableType))
  type: CommentableType;

  @IsInt()
  @Min(1)
  @Max(2147483647)
  id: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2147483647)
  parentId?: number;

  @IsString()
  @MaxLength(10000)
  content: string;
}
