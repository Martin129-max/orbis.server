import { join } from 'node:path';
import sharp = require('sharp');
import type { DiscordReport } from './discord';
import { ticketNumber } from './ticket';

const fontfile = join(__dirname, '../../assets/fonts/NotoSans-Regular.ttf');
const statuses = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
const categories = { bug: 'Bug', idea: 'Idea', other: 'Other' };
const colors = { bug: '#b7312b', idea: '#9b6a13', other: '#625d55' };

function escape(text: string) {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character]!,
  );
}

function preview(value: string, limit: number) {
  const characters = Array.from(value.trim());
  return characters.length > limit
    ? `${characters
        .slice(0, limit - 1)
        .join('')
        .trimEnd()}…`
    : characters.join('');
}

async function text(
  value: string,
  size: number,
  color: string,
  width: number,
  height: number,
) {
  let content = value.trim() || '—';
  for (;;) {
    const rendered = await sharp({
      text: {
        text: `<span foreground="${color}">${escape(content)}</span>`,
        font: `Noto Sans ${size}`,
        fontfile,
        width,
        rgba: true,
        wrap: 'word-char',
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    if (rendered.info.height <= height || Array.from(content).length <= 1)
      return rendered.data;
    content = preview(
      content,
      Math.max(1, Math.floor(Array.from(content).length * 0.8)),
    );
  }
}

export async function renderReportCard(
  report: DiscordReport,
  activity?: { title: string; description?: string },
): Promise<Buffer> {
  const color = colors[report.category];
  const background = Buffer.from(
    `<svg width="1200" height="675" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="675" fill="#f5f2eb"/><rect width="12" height="675" fill="${color}"/><rect x="38" y="136" width="1124" height="330" rx="18" fill="#fffefa"/><path d="M48 502H1152" stroke="#d6d0c5"/><circle cx="1160" cy="20" r="150" fill="none" stroke="#ddd7cb"/></svg>`,
  );
  const name = (person: DiscordReport['author']) =>
    person.name
      ? `${person.name} (@${person.username})`
      : `@${person.username}`;
  const layers = await Promise.all(
    [
      {
        value: 'orbis. / TICKETS',
        size: 22,
        color: '#b23b26',
        x: 48,
        y: 28,
        width: 400,
        height: 32,
      },
      {
        value: `${ticketNumber(report.id)} · ${categories[report.category]}`,
        size: 38,
        color: '#242320',
        x: 48,
        y: 74,
        width: 760,
        height: 52,
      },
      {
        value: `${statuses[report.status]}${report.hiddenAt ? ' · Hidden' : ''}`,
        size: 24,
        color,
        x: 840,
        y: 85,
        width: 310,
        height: 38,
      },
      {
        value: preview(activity?.title ?? 'New ticket', 110),
        size: 25,
        color: '#b23b26',
        x: 64,
        y: 158,
        width: 1072,
        height: 70,
      },
      {
        value: preview(report.message, activity?.description ? 220 : 420),
        size: 27,
        color: '#242320',
        x: 64,
        y: 240,
        width: 1072,
        height: activity?.description ? 102 : 202,
      },
      ...(activity?.description
        ? [
            {
              value: `Latest update: ${preview(activity.description, 180)}`,
              size: 22,
              color: '#625d55',
              x: 64,
              y: 362,
              width: 1072,
              height: 82,
            },
          ]
        : []),
      {
        value: 'REPORTED BY',
        size: 17,
        color: '#625d55',
        x: 48,
        y: 528,
        width: 520,
        height: 26,
      },
      {
        value: preview(name(report.author), 80),
        size: 23,
        color: '#242320',
        x: 48,
        y: 565,
        width: 520,
        height: 64,
      },
      {
        value: 'ASSIGNED TO',
        size: 17,
        color: '#625d55',
        x: 650,
        y: 528,
        width: 500,
        height: 26,
      },
      {
        value: report.assignee
          ? preview(name(report.assignee), 80)
          : 'Unassigned',
        size: 23,
        color: '#242320',
        x: 650,
        y: 565,
        width: 500,
        height: 64,
      },
      {
        value: `Created ${report.createdAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
        size: 16,
        color: '#625d55',
        x: 48,
        y: 642,
        width: 1000,
        height: 24,
      },
    ].map(async (layer) => ({
      input: await text(
        layer.value,
        layer.size,
        layer.color,
        layer.width,
        layer.height,
      ),
      left: layer.x,
      top: layer.y,
    })),
  );
  return sharp(background).composite(layers).png().toBuffer();
}
