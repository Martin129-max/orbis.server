import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MAX_INT } from './community-member.guard';
import { requireViewAccess } from './require-membership';

@Injectable()
export class CommunityViewerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const communityId = Number(request.params.communityId);

    if (
      !Number.isInteger(communityId) ||
      communityId < 1 ||
      communityId > MAX_INT
    ) {
      throw new BadRequestException('Invalid community id');
    }

    await requireViewAccess(this.prisma, request.user.userId, communityId);
    return true;
  }
}
