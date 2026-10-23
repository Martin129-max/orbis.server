import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { author } from '../common/author';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { ticketNumber } from './ticket';
import { getReporterStatusLabel } from './status-labels';
import { isHeadAdmin } from '../users/head-admin';

const reportSelect = {
  id: true,
  category: true,
  status: true,
  message: true,
  pageUrl: true,
  resolutionNote: true,
  createdAt: true,
  author,
} as const;

const adminReportSelect = { ...reportSelect, hiddenAt: true } as const;

const NOTE_PREVIEW = 140;

function preview(note: string) {
  return note.length > NOTE_PREVIEW
    ? `${note.slice(0, NOTE_PREVIEW - 1).trimEnd()}…`
    : note;
}

@Injectable()
export class ReportsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(
    userId: number,
    { category, message, pageUrl }: CreateReportDto,
  ) {
    const text = message.trim();
    if (!text) throw new BadRequestException('Write a message');

    return this.prisma.report.create({
      data: { authorId: userId, category, message: text, pageUrl },
      select: { id: true },
    });
  }

  async findAll(userId: number, hidden: boolean) {
    await this.requireAdmin(userId);

    return this.prisma.report.findMany({
      where: { hiddenAt: hidden ? { not: null } : null },
      orderBy: hidden ? { hiddenAt: 'desc' } : { createdAt: 'desc' },
      select: adminReportSelect,
    });
  }

  mine(userId: number) {
    return this.prisma.report.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      select: reportSelect,
    });
  }

  async update(userId: number, id: number, { status, note }: UpdateReportDto) {
    await this.requireAdmin(userId);

    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { status: true, category: true, authorId: true },
    });
    if (!report) throw new NotFoundException('Report not found');

    const resolutionNote = status === 'done' ? note?.trim() || null : null;
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status, resolutionNote },
      select: adminReportSelect,
    });

    if (report.status !== status) {
      const label = getReporterStatusLabel(status, report.category);
      await this.notifications.notify([
        {
          userId: report.authorId,
          actorId: userId,
          type: 'report_status',
          message: resolutionNote
            ? `updated your report ${ticketNumber(id)}: ${label} — “${preview(resolutionNote)}”`
            : `updated your report ${ticketNumber(id)}: ${label}`,
          link: '/reports',
        },
      ]);
    }

    return updated;
  }

  async hide(userId: number, id: number) {
    await this.requireAdmin(userId);
    await this.requireReport(id);

    return this.prisma.report.update({
      where: { id },
      data: { hiddenAt: new Date() },
      select: adminReportSelect,
    });
  }

  async restore(userId: number, id: number) {
    await this.requireAdmin(userId);
    await this.requireReport(id);

    return this.prisma.report.update({
      where: { id },
      data: { hiddenAt: null, status: 'todo', resolutionNote: null },
      select: adminReportSelect,
    });
  }

  private async requireReport(id: number) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!report) throw new NotFoundException('Report not found');
  }

  private async requireAdmin(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, email: true },
    });
    if (!user || !(user.isAdmin || isHeadAdmin(user.email))) {
      throw new ForbiddenException('Only site admins can see reports');
    }
  }
}
