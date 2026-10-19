import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ReorderCommunitiesDto } from './dto/reorder-communities.dto';
import { CommunityMemberGuard } from './community-member.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Community as CommunityModel } from '../../prisma/generated/client';

@Controller('communities')
@UseGuards(JwtAuthGuard)
export class CommunitiesController {
  constructor(private readonly communitiesService: CommunitiesService) {}

  @Post()
  create(
    @Req() req,
    @Body() createCommunityDto: CreateCommunityDto,
  ): Promise<CommunityModel> {
    return this.communitiesService.create(req.user.userId, createCommunityDto);
  }

  @Get()
  findMine(@Req() req): Promise<CommunityModel[]> {
    return this.communitiesService.findForMember(req.user.userId);
  }

  @Put('order')
  reorder(
    @Req() req,
    @Body() reorderCommunitiesDto: ReorderCommunitiesDto,
  ): Promise<CommunityModel[]> {
    return this.communitiesService.reorder(
      req.user.userId,
      reorderCommunitiesDto,
    );
  }

  @Get(':communityId')
  @UseGuards(CommunityMemberGuard)
  findOne(
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<CommunityModel | null> {
    return this.communitiesService.findOne(communityId);
  }
}
