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
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { RateLimit, MINUTE } from '../common/throttle';

@Controller('communities/:communityId/posts')
@UseGuards(JwtAuthGuard, CommunityMemberGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
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

  @RateLimit(10, MINUTE)
  @Post()
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
