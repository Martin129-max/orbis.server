import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { SetWebhookDto } from './dto/set-webhook.dto';
import { AssignReportDto } from './dto/assign-report.dto';
import { CreateReportCommentDto } from './dto/create-report-comment.dto';
import { ReportsService } from './reports.service';
import { HOUR, MINUTE, RateLimit } from '../common/throttle';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RateLimit(5, HOUR)
  @Post()
  create(@Req() req, @Body() createReportDto: CreateReportDto) {
    return this.reportsService.create(req.user.userId, createReportDto);
  }

  @Get('mine')
  mine(@Req() req) {
    return this.reportsService.mine(req.user.userId);
  }

  @Get()
  findAll(@Req() req, @Query('hidden') hidden?: string) {
    return this.reportsService.findAll(req.user.userId, hidden === 'true');
  }

  @Get('webhook')
  webhook(@Req() req) {
    return this.reportsService.webhook(req.user.userId);
  }

  @Put('webhook')
  setWebhook(@Req() req, @Body() { url }: SetWebhookDto) {
    return this.reportsService.setWebhook(req.user.userId, url);
  }

  @Delete('webhook')
  removeWebhook(@Req() req) {
    return this.reportsService.removeWebhook(req.user.userId);
  }

  @Get('admins')
  admins(@Req() req) {
    return this.reportsService.admins(req.user.userId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.reportsService.findOne(req.user.userId, id);
  }

  @Put(':id/assignee')
  assign(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() { assigneeId }: AssignReportDto,
  ) {
    return this.reportsService.assign(req.user.userId, id, assigneeId ?? null);
  }

  @Get(':id/comments')
  comments(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.reportsService.comments(req.user.userId, id);
  }

  @RateLimit(20, MINUTE)
  @Post(':id/comments')
  addComment(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() { content }: CreateReportCommentDto,
  ) {
    return this.reportsService.addComment(req.user.userId, id, content);
  }

  @Put(':id/hidden')
  hide(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.reportsService.hide(req.user.userId, id);
  }

  @Delete(':id/hidden')
  restore(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.reportsService.restore(req.user.userId, id);
  }

  @Patch(':id')
  update(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateReportDto: UpdateReportDto,
  ) {
    return this.reportsService.update(req.user.userId, id, updateReportDto);
  }
}
