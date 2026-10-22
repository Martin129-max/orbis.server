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

@Controller('users/:username/posts')
@UseGuards(JwtAuthGuard)
export class UserPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findForProfile(
    @Req() req,
    @Param('username') username: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.postsService.findForProfile(req.user.userId, username, cursor);
  }

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
