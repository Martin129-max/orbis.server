import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThreadSummary, ThreadsService } from './threads.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { Page } from '../common/pagination';
import { RateLimit, MINUTE } from '../common/throttle';

@Controller('communities/:communityId/threads')
@UseGuards(JwtAuthGuard, CommunityMemberGuard)
export class CommunityThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get()
  findAll(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Query('sort') sort?: string,
    @Query('cursor', new ParseIntPipe({ optional: true })) cursor?: number,
  ): Promise<Page<ThreadSummary>> {
    return this.threadsService.list(req.user.userId, communityId, sort, cursor);
  }

  @RateLimit(10, MINUTE)
  @Post()
  create(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() createThreadDto: CreateThreadDto,
  ): Promise<ThreadSummary> {
    return this.threadsService.create(
      req.user.userId,
      communityId,
      createThreadDto,
    );
  }
}

@Controller('threads')
@UseGuards(JwtAuthGuard)
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get(':threadId')
  findOne(
    @Req() req,
    @Param('threadId', ParseIntPipe) threadId: number,
  ): Promise<ThreadSummary> {
    return this.threadsService.findOne(req.user.userId, threadId);
  }
}
