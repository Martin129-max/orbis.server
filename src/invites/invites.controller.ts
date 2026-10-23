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
import {
  CommunityInvite,
  InvitePreview,
  InvitesService,
} from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CommunityMemberGuard } from '../communities/community-member.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Community as CommunityModel } from '../../prisma/generated/client';
import { RateLimit, HOUR } from '../common/throttle';

@Controller()
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @RateLimit(20, HOUR)
  @Post('communities/:communityId/invites')
  @UseGuards(JwtAuthGuard, CommunityMemberGuard)
  create(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Body() createInviteDto: CreateInviteDto,
  ): Promise<CommunityInvite> {
    return this.invitesService.create(
      req.user.userId,
      communityId,
      createInviteDto,
    );
  }

  @Get('communities/:communityId/invites')
  @UseGuards(JwtAuthGuard, CommunityMemberGuard)
  findForCommunity(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
  ): Promise<CommunityInvite[]> {
    return this.invitesService.findForCommunity(req.user.userId, communityId);
  }

  @Delete('communities/:communityId/invites/:code')
  @UseGuards(JwtAuthGuard, CommunityMemberGuard)
  @HttpCode(204)
  revoke(
    @Req() req,
    @Param('communityId', ParseIntPipe) communityId: number,
    @Param('code') code: string,
  ): Promise<void> {
    return this.invitesService.revoke(req.user.userId, communityId, code);
  }

  @Get('invites/:code')
  preview(@Param('code') code: string): Promise<InvitePreview> {
    return this.invitesService.preview(code);
  }

  @Post('invites/:code')
  @UseGuards(JwtAuthGuard)
  accept(@Req() req, @Param('code') code: string): Promise<CommunityModel> {
    return this.invitesService.accept(req.user.userId, code);
  }
}
