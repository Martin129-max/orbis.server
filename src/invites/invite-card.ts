import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, RGB, rgb } from 'pdf-lib';
import * as QRCode from 'qrcode';
import sharp = require('sharp');
import { webUrl } from '../common/web-url';

const IN = 72;
const BLEED = 0.125;
const TRIM_W = 3.5;
const TRIM_H = 2;
const PAGE_W = TRIM_W + BLEED * 2;
const PAGE_H = TRIM_H + BLEED * 2;
const PHOTO_W = 1.5;
const DPI = 300;
const IMAGE_TIMEOUT_MS = 10_000;

const COLORS = {
  background: '#f5f2eb',
  surface: '#fffefa',
  accent: '#b23b26',
  ink: '#242320',
  muted: '#625d55',
  divider: '#d6d0c5',
  white: '#ffffff',
};

const fontsDir = join(__dirname, '../../assets/fonts');

export type InviteCardInput = {
  name: string;
  iconUrl: string | null;
  coverUrl: string | null;
  backgroundUrl: string | null;
  qrUrl: string;
};

function color(value: string): RGB {
  const n = parseInt(value.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function place(x: number, yFromTop: number) {
  return { x: (BLEED + x) * IN, y: (PAGE_H - BLEED - yFromTop) * IN };
}

function box(x: number, yFromTop: number, width: number, height: number) {
  const { x: left, y: top } = place(x, yFromTop);
  return {
    x: left,
    y: top - height * IN,
    width: width * IN,
    height: height * IN,
  };
}

async function pictureAsPng(
  url: string | null,
  width: number,
  height: number,
  shape: 'rect' | 'circle',
): Promise<Buffer | null> {
  if (!url) return null;

  try {
    const response = await fetch(new URL(url, `${webUrl()}/`), {
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const pixelW = Math.round(width * DPI);
    const pixelH = Math.round(height * DPI);
    const image = sharp(Buffer.from(await response.arrayBuffer()))
      .resize(pixelW, pixelH, { fit: 'cover' })
      .ensureAlpha();
    if (shape === 'circle') {
      const radius = Math.min(pixelW, pixelH) / 2;
      image.composite([
        {
          input: Buffer.from(
            `<svg width="${pixelW}" height="${pixelH}"><circle cx="${pixelW / 2}" cy="${pixelH / 2}" r="${radius}"/></svg>`,
          ),
          blend: 'dest-in',
        },
      ]);
    }
    return await image.png().toBuffer();
  } catch {
    return null;
  }
}

function widthIn(font: PDFFont, text: string, sizeIn: number) {
  return font.widthOfTextAtSize(text, sizeIn * IN) / IN;
}

function wrap(font: PDFFont, text: string, sizeIn: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (widthIn(font, candidate, sizeIn) <= maxWidth) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(
  font: PDFFont,
  text: string,
  maxWidth: number,
  maxLines: number,
  start: number,
  min: number,
) {
  for (let size = start; size >= min; size -= 0.002) {
    const lines = wrap(font, text, size, maxWidth);
    if (
      lines.length <= maxLines &&
      lines.every((l) => widthIn(font, l, size) <= maxWidth)
    ) {
      return { size, lines };
    }
  }
  return {
    size: min,
    lines: wrap(font, text, min, maxWidth).slice(0, maxLines),
  };
}

function drawLines(
  page: PDFPage,
  font: PDFFont,
  lines: string[],
  size: number,
  x: number,
  firstBaseline: number,
  step: number,
  fill: RGB,
) {
  lines.forEach((line, index) => {
    const { x: left, y } = place(x, firstBaseline + index * step);
    page.drawText(line, { x: left, y, size: size * IN, font, color: fill });
  });
}

export async function buildInviteCard({
  name,
  iconUrl,
  coverUrl,
  backgroundUrl,
  qrUrl,
}: InviteCardInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${name} Invite Card`);
  pdf.setAuthor('Polsar Studio');
  pdf.setSubject(`Permanent QR for ${name}`);

  const [displayFile, bodyBoldFile, bodyFile, cover, icon, wallpaper] =
    await Promise.all([
      readFile(join(fontsDir, 'BarlowCondensed-ExtraBold.ttf')),
      readFile(join(fontsDir, 'Inter-SemiBold.ttf')),
      readFile(join(fontsDir, 'Inter-Regular.ttf')),
      pictureAsPng(coverUrl, PHOTO_W + BLEED, TRIM_H + BLEED * 2, 'rect'),
      pictureAsPng(iconUrl, 0.62, 0.62, 'circle'),
      pictureAsPng(backgroundUrl, PAGE_W, PAGE_H, 'rect'),
    ]);
  const display = await pdf.embedFont(displayFile, { subset: false });
  const bodyBold = await pdf.embedFont(bodyBoldFile, { subset: false });
  const body = await pdf.embedFont(bodyFile, { subset: false });

  const bg = color(COLORS.background);
  const surface = color(COLORS.surface);
  const accent = color(COLORS.accent);
  const ink = color(COLORS.ink);
  const muted = color(COLORS.muted);
  const divider = color(COLORS.divider);
  const white = color(COLORS.white);

  const mark = 0.22;
  const markX = TRIM_W - 0.08 - widthIn(display, 'o.', mark);
  const markY = 0.18;

  const front = pdf.addPage([PAGE_W * IN, PAGE_H * IN]);
  front.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W * IN,
    height: PAGE_H * IN,
    color: bg,
  });

  if (cover) {
    const image = await pdf.embedPng(cover);
    front.drawImage(image, {
      x: 0,
      y: 0,
      width: (PHOTO_W + BLEED) * IN,
      height: PAGE_H * IN,
    });
  } else {
    front.drawRectangle({
      x: 0,
      y: 0,
      width: (PHOTO_W + BLEED) * IN,
      height: PAGE_H * IN,
      color: accent,
    });
  }

  const badge = 0.62;
  const badgeCenter = place(PHOTO_W, 0.95);
  front.drawEllipse({
    x: badgeCenter.x,
    y: badgeCenter.y,
    xScale: (badge / 2 + 0.035) * IN,
    yScale: (badge / 2 + 0.035) * IN,
    color: bg,
  });
  if (icon) {
    const image = await pdf.embedPng(icon);
    front.drawImage(
      image,
      box(PHOTO_W - badge / 2, 0.95 - badge / 2, badge, badge),
    );
  } else {
    front.drawEllipse({
      x: badgeCenter.x,
      y: badgeCenter.y,
      xScale: (badge / 2) * IN,
      yScale: (badge / 2) * IN,
      color: accent,
    });
    const initial = name.trim().charAt(0).toUpperCase() || 'O';
    const size = 0.3;
    const width = widthIn(display, initial, size);
    const { x: left, y } = place(PHOTO_W - width / 2, 0.95 + size * 0.36);
    front.drawText(initial, {
      x: left,
      y,
      size: size * IN,
      font: display,
      color: white,
    });
  }

  const textX = 1.95;
  const textWidth = TRIM_W - textX - 0.2;
  drawLines(
    front,
    bodyBold,
    ['COMMUNITY ON ORBIS'],
    0.065,
    textX,
    0.5,
    0,
    muted,
  );
  const title = fitText(display, name, textWidth, 2, 0.27, 0.16);
  drawLines(
    front,
    display,
    title.lines,
    title.size,
    textX,
    0.78,
    title.size * 1.02,
    ink,
  );
  drawLines(
    front,
    bodyBold,
    ['Join us on Orbis.'],
    0.095,
    textX,
    1.56,
    0,
    accent,
  );
  drawLines(front, body, ['By Polsar Studio'], 0.075, textX, 1.8, 0, muted);
  drawLines(front, display, ['o.'], mark, markX, markY, 0, accent);

  const back = pdf.addPage([PAGE_W * IN, PAGE_H * IN]);
  back.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W * IN,
    height: PAGE_H * IN,
    color: surface,
  });

  if (wallpaper) {
    const image = await pdf.embedPng(wallpaper);
    back.drawImage(image, {
      x: 0,
      y: 0,
      width: PAGE_W * IN,
      height: PAGE_H * IN,
    });
    back.drawRectangle({
      x: 0,
      y: 0,
      width: PAGE_W * IN,
      height: PAGE_H * IN,
      color: surface,
      opacity: 0.5,
    });
  }

  const qrBox = box(0.28, 0.28, 1.44, 1.44);
  back.drawRectangle({
    ...qrBox,
    color: white,
    borderColor: divider,
    borderWidth: 0.75,
  });

  const qr = QRCode.create(qrUrl, { errorCorrectionLevel: 'M' }).modules;
  const quiet = 4;
  const total = qr.size + quiet * 2;
  const cell = 1.3 / total;
  for (let row = 0; row < qr.size; row += 1) {
    for (let col = 0; col < qr.size; col += 1) {
      if (!qr.data[row * qr.size + col]) continue;
      const x = 0.35 + (quiet + col) * cell;
      const yTop = 0.35 + (quiet + row) * cell;
      back.drawRectangle({ ...box(x, yTop, cell, cell), color: ink });
    }
  }

  drawLines(back, bodyBold, ['SCAN TO JOIN'], 0.07, 2.02, 0.37, 0, muted);
  const headline = fitText(display, `Join ${name}.`, 1.22, 2, 0.235, 0.14);
  drawLines(
    back,
    display,
    headline.lines,
    headline.size,
    2.02,
    0.66,
    headline.size * 1.02,
    ink,
  );
  back.drawRectangle({ ...box(2.02, 1.17, 0.5, 0.05), color: accent });
  const note = fitText(
    body,
    'Scan with your phone to join on Orbis.',
    1.22,
    2,
    0.07,
    0.07,
  );
  drawLines(back, body, note.lines, note.size, 2.02, 1.62, 0.1, muted);
  drawLines(back, display, ['o.'], mark, markX, markY, 0, accent);

  return pdf.save();
}
