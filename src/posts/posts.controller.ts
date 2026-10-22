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

@Controller('communities/:communityId/posts')
@UseGuards(JwtAuthGuard, CommunityMemberGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(
    @Param('communityId', ParseIntPipe) communityId: number,
    @Query('cursor') cursor?: string,
  ) {
    return this.postsService.findForCommunity(communityId, cursor);
  }

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
