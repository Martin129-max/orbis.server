import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const RATE_LIMIT_MESSAGE =
  'You’re doing that too often. Try again in a minute';

export const RateLimit = (limit: number, ttl: number) =>
  Throttle({ default: { limit, ttl } });

const jwt = new JwtService();

function userOf(authorization: unknown) {
  if (typeof authorization !== 'string') return null;
  if (!authorization.startsWith('Bearer ')) return null;
  try {
    const { sub } = jwt.verify<{ sub: number }>(authorization.slice(7), {
      secret: process.env.JWT_SECRET,
    });
    return typeof sub === 'number' ? sub : null;
  } catch {
    return null;
  }
}

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = userOf(req.headers?.authorization);
    if (user !== null) return `user:${user}`;

    const flyClientIp = req.headers?.['fly-client-ip'];
    return `ip:${typeof flyClientIp === 'string' && flyClientIp ? flyClientIp : req.ip}`;
  }
}
