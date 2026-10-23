import {
  Body,
  Controller,
  Delete,
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
import { MINUTE, RateLimit } from '../common/throttle';
import { SendMessageDto } from './dto/send-message.dto';
import {
  ChatMessage,
  InboxEntry,
  MessagesService,
  Thread,
} from './messages.service';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  inbox(@Req() req): Promise<InboxEntry[]> {
    return this.messagesService.inbox(req.user.userId);
  }

  @Get(':userId')
  thread(
    @Req() req,
    @Param('userId', ParseIntPipe) userId: number,
    @Query('before', new ParseIntPipe({ optional: true })) before?: number,
  ): Promise<Thread> {
    return this.messagesService.thread(req.user.userId, userId, before);
  }

  @RateLimit(60, MINUTE)
  @Post(':userId')
  send(
    @Req() req,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() { text }: SendMessageDto,
  ): Promise<ChatMessage> {
    return this.messagesService.send(req.user.userId, userId, text);
  }

  @Post(':userId/read')
  @HttpCode(204)
  read(
    @Req() req,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    return this.messagesService.read(req.user.userId, userId);
  }

  @Post(':userId/accept')
  @HttpCode(204)
  accept(
    @Req() req,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    return this.messagesService.accept(req.user.userId, userId);
  }

  @Delete(':userId')
  @HttpCode(204)
  decline(
    @Req() req,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    return this.messagesService.decline(req.user.userId, userId);
  }
}
