import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @MaxLength(10000)
  content: string;

  @IsOptional()
  @MaxLength(2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  linkUrl?: string;
}
