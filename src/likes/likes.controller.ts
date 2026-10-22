import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { LikeResult, LikesService } from './likes.service';
import { LikeDto } from './dto/like.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('likes')
@UseGuards(JwtAuthGuard)
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Put()
  setLike(@Req() req, @Body() likeDto: LikeDto): Promise<LikeResult> {
    return this.likesService.setLike(req.user.userId, likeDto);
  }
}
