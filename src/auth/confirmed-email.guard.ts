import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';

const ALLOW_UNCONFIRMED = 'allowUnconfirmed';
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const EMAIL_UNCONFIRMED = 'email_unconfirmed';

export const AllowUnconfirmed = () => SetMetadata(ALLOW_UNCONFIRMED, true);

@Injectable()
export class ConfirmedEmailGuard implements CanActivate {
  private readonly jwt = new JwtService({ secret: process.env.JWT_SECRET });

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest();
    if (!WRITE_METHODS.has(request.method)) return true;
    if (
      this.reflector.getAllAndOverride<boolean>(ALLOW_UNCONFIRMED, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const header = request.headers?.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return true;
    }
    let userId: number;
    try {
      userId = this.jwt.verify<{ sub: number }>(header.slice(7)).sub;
    } catch {
      return true;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { emailVerifiedAt: true },
    });
    if (user && !user.emailVerifiedAt) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: EMAIL_UNCONFIRMED,
        message:
          'Confirm your email to do this. Check your inbox for the link, or send a new one from the top of the page',
      });
    }
    return true;
  }
}
