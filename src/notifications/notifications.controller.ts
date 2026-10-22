import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @Req() req,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
    @Query('q') q?: string,
    @Query('filter') filter?: string,
    @Query('unread') unread?: string,
  ) {
    return this.notificationsService.list(req.user.userId, {
      cursor,
      q,
      filter,
      unread: unread === 'true',
    });
  }

  @Get('unread')
  unreadCount(@Req() req) {
    return this.notificationsService.unreadCount(req.user.userId);
  }

  @Post('read')
  @HttpCode(204)
  markAllRead(@Req() req): Promise<void> {
    return this.notificationsService.markAllRead(req.user.userId);
  }

  @Post(':id/read')
  @HttpCode(204)
  markRead(@Req() req, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.notificationsService.markRead(req.user.userId, id);
  }
}
