import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AllowGuest } from '../auth/allow-guest';
import { RateLimit, MINUTE } from '../common/throttle';

@Controller('users/:username/posts')
@UseGuards(JwtAuthGuard)
export class UserPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  @AllowGuest()
  findForProfile(
    @Req() req,
    @Param('username') username: string,
    @Query('cursor') cursor?: string,
    @Query('exclude') exclude?: string,
  ) {
    return this.postsService.findForProfile(
      req.user.userId,
      username,
      cursor,
      exclude,
    );
  }

  @RateLimit(60, MINUTE)
  @Get('search')
  @AllowGuest()
  search(@Req() req, @Param('username') username: string, @Query('q') q = '') {
    return this.postsService.searchProfile(req.user.userId, username, q);
  }

  @RateLimit(10, MINUTE)
  @Post()
  createOnWall(
    @Req() req,
    @Param('username') username: string,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.postsService.createOnWall(
      username,
      req.user.userId,
      createPostDto,
    );
  }
}
