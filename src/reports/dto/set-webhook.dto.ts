import { IsUrl, Matches, MaxLength } from 'class-validator';
import { DISCORD_WEBHOOK } from '../discord';

export class SetWebhookDto {
  @Matches(DISCORD_WEBHOOK, { message: 'Enter a Discord webhook URL' })
  url: string;

  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_tld: false,
    },
    { message: 'Enter the site URL, like https://orbis.polsar.studio' },
  )
  @MaxLength(200)
  siteUrl: string;
}
