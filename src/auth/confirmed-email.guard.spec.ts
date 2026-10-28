import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfirmedEmailGuard } from './confirmed-email.guard';
import { PrismaService } from '../prisma.service';

describe('ConfirmedEmailGuard', () => {
  process.env.JWT_SECRET = 'test-secret';
  const prisma = { user: { findUnique: jest.fn() } };
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new ConfirmedEmailGuard(
    reflector as unknown as Reflector,
    prisma as unknown as PrismaService,
  );
  const token = new JwtService({ secret: 'test-secret' }).sign({ sub: 7 });

  function context(method: string, authorization?: string) {
    return {
      getType: () => 'http',
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({
        getRequest: () => ({ method, headers: { authorization } }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(undefined);
  });

  it('refuses changes from someone who hasn’t confirmed their email', async () => {
    prisma.user.findUnique.mockResolvedValue({ emailVerifiedAt: null });

    const refusal = guard.canActivate(context('POST', `Bearer ${token}`));

    await expect(refusal).rejects.toThrow(ForbiddenException);
    await expect(refusal).rejects.toMatchObject({
      response: { code: 'email_unconfirmed' },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 7 } }),
    );
  });

  it('lets someone with a confirmed email make changes', async () => {
    prisma.user.findUnique.mockResolvedValue({
      emailVerifiedAt: new Date('2026-10-01T00:00:00Z'),
    });

    await expect(
      guard.canActivate(context('DELETE', `Bearer ${token}`)),
    ).resolves.toBe(true);
  });

  it('lets everyone read', async () => {
    await expect(
      guard.canActivate(context('GET', `Bearer ${token}`)),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows the actions marked as fine before confirming', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(
      guard.canActivate(context('PATCH', `Bearer ${token}`)),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('leaves logged-out and bad tokens to the route’s own login check', async () => {
    await expect(guard.canActivate(context('POST'))).resolves.toBe(true);
    await expect(
      guard.canActivate(context('POST', 'Bearer not-a-token')),
    ).resolves.toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
