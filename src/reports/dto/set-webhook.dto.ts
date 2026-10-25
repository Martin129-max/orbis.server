import { Matches } from 'class-validator';
import { DISCORD_WEBHOOK } from '../discord';

export class SetWebhookDto {
  @Matches(DISCORD_WEBHOOK, { message: 'Enter a Discord webhook URL' })
  url: string;
}
