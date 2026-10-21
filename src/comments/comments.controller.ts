import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommentView, CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findAll(
    @Req() req,
    @Query('type') type: string,
    @Query('id', ParseIntPipe) id: number,
  ): Promise<CommentView[]> {
    return this.commentsService.list(req.user.userId, type, id);
  }

  @Post()
  create(
    @Req() req,
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<CommentView> {
    return this.commentsService.create(req.user.userId, createCommentDto);
  }
}
