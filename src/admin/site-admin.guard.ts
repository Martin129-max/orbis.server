import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { isHeadAdmin } from '../users/head-admin';

@Injectable()
export class SiteAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.userId },
      select: { isAdmin: true, email: true },
    });

    if (!user || !(user.isAdmin || isHeadAdmin(user.email))) {
      throw new ForbiddenException('Only site admins can do this');
    }
    return true;
  }
}
