import { ReportCategory } from '../../prisma/generated/client';
import { ticketNumber } from './ticket';

export const DISCORD_WEBHOOK =
  /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{17,20}\/[\w-]{60,100}$/;

const categoryStyle: Record<
  ReportCategory,
  { label: string; emoji: string; color: number }
> = {
  bug: { label: 'Bug', emoji: '🐞', color: 0xe5484d },
  idea: { label: 'Idea', emoji: '💡', color: 0xf0c46c },
  other: { label: 'Other', emoji: '💬', color: 0x99958e },
};

export type DiscordReport = {
  id: number;
  category: ReportCategory;
  message: string;
  pageUrl: string | null;
  createdAt: Date;
  author: { username: string; name: string | null };
};

export type DiscordTarget = { webhookUrl: string; siteUrl: string };

function payload(report: DiscordReport, siteUrl: string, withButton: boolean) {
  const style = categoryStyle[report.category];
  const link = `${siteUrl.replace(/\/$/, '')}/reports?report=${report.id}`;
  const from = report.author.name
    ? `${report.author.name} (@${report.author.username})`
    : `@${report.author.username}`;

  return {
    username: 'Orbis Reports',
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `${style.emoji} ${style.label} report ${ticketNumber(report.id)}`,
        url: link,
        description: report.message.slice(0, 4000),
        color: style.color,
        fields: [
          { name: 'From', value: from, inline: true },
          ...(report.pageUrl
            ? [{ name: 'Page', value: report.pageUrl, inline: true }]
            : []),
        ],
        timestamp: report.createdAt.toISOString(),
      },
    ],
    ...(withButton
      ? {
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 5, label: 'View report', url: link },
              ],
            },
          ],
        }
      : {}),
  };
}

async function send(url: string, body: unknown) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

export type DiscordActivity = {
  reportId: number;
  title: string;
  description?: string;
  color: number;
};

export const ACTIVITY_COLOR = {
  comment: 0x6fa0f0,
  move: 0x83ac83,
  hide: 0x777970,
  assign: 0xb195f2,
} as const;

export async function postActivityToDiscord(
  { webhookUrl, siteUrl }: DiscordTarget,
  { reportId, title, description, color }: DiscordActivity,
) {
  const link = `${siteUrl.replace(/\/$/, '')}/reports?report=${reportId}`;
  const embed = {
    title,
    url: link,
    description: description?.slice(0, 4000),
    color,
    timestamp: new Date().toISOString(),
  };
  const button = {
    components: [
      {
        type: 1,
        components: [{ type: 2, style: 5, label: 'View report', url: link }],
      },
    ],
  };
  const base = {
    username: 'Orbis Reports',
    allowed_mentions: { parse: [] },
    embeds: [embed],
  };

  const withButton = await send(`${webhookUrl}?with_components=true`, {
    ...base,
    ...button,
  });
  if (withButton.ok) return;

  const plain = await send(webhookUrl, base);
  if (!plain.ok) {
    throw new Error(`Discord responded with ${plain.status}`);
  }
}

export async function postReportToDiscord(
  { webhookUrl, siteUrl }: DiscordTarget,
  report: DiscordReport,
) {
  const withButton = await send(
    `${webhookUrl}?with_components=true`,
    payload(report, siteUrl, true),
  );
  if (withButton.ok) return;

  const plain = await send(webhookUrl, payload(report, siteUrl, false));
  if (!plain.ok) {
    throw new Error(`Discord responded with ${plain.status}`);
  }
}
