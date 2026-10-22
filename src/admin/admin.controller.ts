import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  AdminService,
  DirectoryCommunity,
  DirectoryPage,
  DirectoryUser,
  DIRECTORY_PAGE_SIZE,
} from './admin.service';
import { SiteAdminGuard } from './site-admin.guard';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MAX_INT } from '../communities/community-member.guard';

const pageOf = (page: number) =>
  Math.min(Math.max(page, 1), Math.floor(MAX_INT / DIRECTORY_PAGE_SIZE) + 1);

@Controller('admin')
@UseGuards(JwtAuthGuard, SiteAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  users(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<DirectoryPage<DirectoryUser>> {
    return this.adminService.users(pageOf(page));
  }

  @Get('communities')
  communities(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<DirectoryPage<DirectoryCommunity>> {
    return this.adminService.communities(pageOf(page));
  }
}
