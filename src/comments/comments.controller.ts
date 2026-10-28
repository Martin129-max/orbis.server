import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommentView, CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AllowGuest } from '../auth/allow-guest';
import { RateLimit, MINUTE } from '../common/throttle';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @AllowGuest()
  findAll(
    @Req() req,
    @Query('type') type: string,
    @Query('id', ParseIntPipe) id: number,
  ): Promise<CommentView[]> {
    return this.commentsService.list(req.user.userId, type, id);
  }

  @RateLimit(20, MINUTE)
  @Post()
  create(
    @Req() req,
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<CommentView> {
    return this.commentsService.create(req.user.userId, createCommentDto);
  }

  @RateLimit(30, MINUTE)
  @Patch(':commentId')
  update(
    @Req() req,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() updateCommentDto: UpdateCommentDto,
  ): Promise<CommentView> {
    return this.commentsService.update(
      req.user.userId,
      commentId,
      updateCommentDto,
    );
  }

  @RateLimit(30, MINUTE)
  @Delete(':commentId')
  @HttpCode(204)
  remove(
    @Req() req,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<void> {
    return this.commentsService.remove(req.user.userId, commentId);
  }
}
