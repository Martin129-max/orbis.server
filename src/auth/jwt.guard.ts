import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_GUEST, GUEST_USER_ID } from './allow-guest';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
  ): TUser {
    if (!user && this.allowsGuest(context)) {
      return { userId: GUEST_USER_ID } as TUser;
    }
    return super.handleRequest(err, user, info, context);
  }

  private allowsGuest(context: ExecutionContext) {
    return this.reflector.getAllAndOverride<boolean>(ALLOW_GUEST, [
      context.getHandler(),
      context.getClass(),
    ]);
  }
}
