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
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
