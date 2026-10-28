import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MINUTE, RateLimit } from '../common/throttle';

@Controller('feed')
@UseGuards(JwtAuthGuard)
export class FeedController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findMine(
    @Req() req,
    @Query('cursor') cursor?: string,
    @Query('exclude') exclude?: string,
  ) {
    return this.postsService.findForMember(req.user.userId, cursor, exclude);
  }

  @RateLimit(60, MINUTE)
  @Get('search')
  search(@Req() req, @Query('q') q = '') {
    return this.postsService.searchFeed(req.user.userId, q);
  }
}
