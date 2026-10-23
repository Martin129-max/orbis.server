import { renderReportCard } from './report-card';
import type { DiscordReport } from './discord';
import sharp = require('sharp');

const report: DiscordReport = {
  id: 42,
  category: 'bug',
  status: 'todo',
  message: 'The icon disappears outside its folder.',
  pageUrl: null,
  createdAt: new Date('2026-10-24T12:00:00Z'),
  author: { username: 'reader', name: 'Reader', avatarUrl: null },
  assignee: null,
  hiddenAt: null,
  resolutionNote: null,
};

describe('Discord ticket image', () => {
  it.each(['bug', 'idea', 'other'] as const)(
    'renders a bounded PNG for %s',
    async (category) => {
      const image = await renderReportCard({ ...report, category });
      expect(await sharp(image).metadata()).toMatchObject({
        format: 'png',
        width: 1200,
        height: 675,
      });
      expect(image.length).toBeLessThan(1024 * 1024);
    },
  );

  it('fits long, multiline, Unicode and markup text without interpreting markup', async () => {
    const image = await renderReportCard(
      {
        ...report,
        status: 'done',
        hiddenAt: new Date(),
        message: '<span foreground="red">A & B</span>\n日本語 café 🎉 '.repeat(
          60,
        ),
        author: { ...report.author, name: 'A very long name '.repeat(30) },
        assignee: report.author,
      },
      {
        title: 'A long activity '.repeat(40),
        description: '<b>Updated & resolved</b>\n'.repeat(30),
      },
    );
    expect(await sharp(image).metadata()).toMatchObject({
      width: 1200,
      height: 675,
    });
  });
});
