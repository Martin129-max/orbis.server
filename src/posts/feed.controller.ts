import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findMine(@Req() req, @Query('cursor') cursor?: string) {
    return this.postsService.findForMember(req.user.userId, cursor);
  }
}
