import { IsUrl, MaxLength } from 'class-validator';

export class PreviewLinkDto {
  @MaxLength(2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url: string;
}
