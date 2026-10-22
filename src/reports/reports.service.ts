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
import { isHeadAdmin } from '../users/head-admin';
import { ReportStatus } from '../../prisma/generated/client';

const statusLabels: Record<ReportStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
};

const reportSelect = {
  id: true,
  category: true,
  status: true,
  message: true,
  pageUrl: true,
  createdAt: true,
  author,
} as const;

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

  async findAll(userId: number) {
    await this.requireAdmin(userId);

    return this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      select: reportSelect,
    });
  }

  mine(userId: number) {
    return this.prisma.report.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      select: reportSelect,
    });
  }

  async update(userId: number, id: number, { status }: UpdateReportDto) {
    await this.requireAdmin(userId);

    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { status: true, authorId: true },
    });
    if (!report) throw new NotFoundException('Report not found');

    const updated = await this.prisma.report.update({
      where: { id },
      data: { status },
      select: reportSelect,
    });

    if (report.status !== status) {
      await this.notifications.notify([
        {
          userId: report.authorId,
          actorId: userId,
          type: 'report_status',
          message: `moved your report ${ticketNumber(id)} to ${statusLabels[status]}`,
          link: '/reports',
        },
      ]);
    }

    return updated;
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
