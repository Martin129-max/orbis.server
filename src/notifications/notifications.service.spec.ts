import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma.service';
import { PresenceGateway } from '../friends/presence.gateway';

describe('NotificationsService.notify', () => {
  const date = new Date('2026-10-24T12:00:00Z');
  const row = (id: number, userId: number) => ({
    id,
    userId,
    type: 'friend_request',
    message: 'sent you a friend request',
    link: '/',
    readAt: null,
    createdAt: date,
    actor: { id: 9, username: 'admin', name: 'Admin', avatarUrl: null },
  });
  const createManyAndReturn = jest.fn();
  const prisma = { notification: { createManyAndReturn } };
  const presence = { notify: jest.fn() };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    presence as unknown as PresenceGateway,
  );

  const input = (userId: number, actorId: number | null = 9) => ({
    userId,
    actorId,
    type: 'friend_request' as const,
    message: 'sent you a friend request',
    link: '/',
  });

  beforeEach(() => jest.clearAllMocks());

  it('sends each recipient only their own new notifications', async () => {
    createManyAndReturn.mockResolvedValue([row(1, 4), row(2, 5), row(3, 4)]);

    await service.notify([input(4), input(5)]);

    expect(presence.notify).toHaveBeenCalledTimes(2);
    expect(presence.notify).toHaveBeenCalledWith([4], 'notifications:changed', {
      notifications: [
        expect.objectContaining({ id: 1, actor: expect.any(Object) }),
        expect.objectContaining({ id: 3 }),
      ],
    });
    const [, , payload] = presence.notify.mock.calls[1];
    expect(payload.notifications.map(({ id }: { id: number }) => id)).toEqual([
      2,
    ]);
    expect(payload.notifications[0]).not.toHaveProperty('userId');
  });

  it('skips notifications about yourself and sends nothing when none remain', async () => {
    await service.notify([input(9, 9)]);

    expect(createManyAndReturn).not.toHaveBeenCalled();
    expect(presence.notify).not.toHaveBeenCalled();
  });
});
