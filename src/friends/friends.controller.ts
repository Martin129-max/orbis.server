import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FriendList, FriendsService } from './friends.service';
import { AddFriendDto } from './dto/add-friend.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('friends')
@UseGuards(JwtAuthGuard)
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  findMine(@Req() req): Promise<FriendList> {
    return this.friendsService.list(req.user.userId);
  }

  @Post()
  @HttpCode(204)
  add(@Req() req, @Body() addFriendDto: AddFriendDto): Promise<void> {
    return this.friendsService.add(req.user.userId, addFriendDto);
  }

  @Delete(':userId')
  @HttpCode(204)
  remove(
    @Req() req,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<void> {
    return this.friendsService.remove(req.user.userId, userId);
  }
}
