import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

function linkOn(...domains: string[]) {
  const hosts = domains.map((domain) => domain.replace(/\./g, '\\.')).join('|');
  return new RegExp(`^https://([a-z0-9-]+\\.)*(${hosts})(/\\S*)?$`, 'i');
}

export class CommunityLinksDto {
  @IsOptional()
  @MaxLength(300)
  @Matches(linkOn('x.com', 'twitter.com'), { message: 'Enter an X link' })
  x?: string;

  @IsOptional()
  @MaxLength(300)
  @Matches(linkOn('youtube.com', 'youtu.be'), {
    message: 'Enter a YouTube link',
  })
  youtube?: string;

  @IsOptional()
  @MaxLength(300)
  @Matches(linkOn('kick.com'), { message: 'Enter a Kick link' })
  kick?: string;

  @IsOptional()
  @MaxLength(300)
  @Matches(linkOn('instagram.com'), { message: 'Enter an Instagram link' })
  instagram?: string;

  @IsOptional()
  @MaxLength(300)
  @Matches(linkOn('tiktok.com'), { message: 'Enter a TikTok link' })
  tiktok?: string;

  @IsOptional()
  @MaxLength(300)
  @Matches(linkOn('reddit.com'), { message: 'Enter a Reddit link' })
  reddit?: string;

  @IsOptional()
  @MaxLength(300)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Enter a website link' },
  )
  website?: string;
}

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

  @IsOptional()
  @ValidateNested()
  @Type(() => CommunityLinksDto)
  links?: CommunityLinksDto;
}
