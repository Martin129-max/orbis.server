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
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AllowGuest } from '../auth/allow-guest';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { CommunityViewerGuard } from '../communities/community-viewer.guard';
import { RateLimit, MINUTE } from '../common/throttle';

@Controller('communities/:communityId/posts')
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @AllowGuest()
  @UseGuards(CommunityViewerGuard)
  findAll(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Query('cursor') cursor?: string,
    @Query('exclude') exclude?: string,
  ) {
    return this.postsService.findForCommunity(
      req.user.userId,
      communityId,
      cursor,
      exclude,
    );
  }

  @RateLimit(60, MINUTE)
  @Get('search')
  @AllowGuest()
  @UseGuards(CommunityViewerGuard)
  search(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Query('q') q = '',
  ) {
    return this.postsService.searchCommunity(req.user.userId, communityId, q);
  }

  @RateLimit(10, MINUTE)
  @Post()
  @UseGuards(CommunityMemberGuard)
  create(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.postsService.create(
      communityId,
      req.user.userId,
      createPostDto,
    );
  }
}
