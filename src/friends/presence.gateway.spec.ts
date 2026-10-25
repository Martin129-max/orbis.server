import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { PrismaService } from '../prisma.service';
import { PresenceGateway } from './presence.gateway';

describe('PresenceGateway', () => {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(null) },
    friendship: { findMany: jest.fn().mockResolvedValue([]) },
    membership: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 7 }) };
  const visible = { appearOffline: false, status: 'online' as const };
  let gateway: PresenceGateway;

  const connect = async () => {
    const client = {
      handshake: { auth: { token: 'token' } },
      connected: true,
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Socket;
    await gateway.handleConnection(client);
    return client;
  };

  beforeEach(() => {
    gateway = new PresenceGateway(
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
    );
  });

  it('is offline without a connection or when appearing offline', async () => {
    expect(gateway.statusOf(7, visible)).toBe('offline');

    await connect();
    expect(gateway.statusOf(7, { ...visible, appearOffline: true })).toBe(
      'offline',
    );
  });

  it('shows busy over online and idle', async () => {
    const client = await connect();
    await gateway.setIdle(client, true);

    expect(gateway.statusOf(7, { ...visible, status: 'busy' })).toBe('busy');
  });

  it('stays idle when idle is chosen, even while active', async () => {
    await connect();

    expect(gateway.statusOf(7, { ...visible, status: 'idle' })).toBe('idle');
  });

  it('is idle only when every connection is idle', async () => {
    const first = await connect();
    const second = await connect();

    await gateway.setIdle(first, true);
    expect(gateway.statusOf(7, visible)).toBe('online');

    await gateway.setIdle(second, true);
    expect(gateway.statusOf(7, visible)).toBe('idle');

    await gateway.setIdle(first, false);
    expect(gateway.statusOf(7, visible)).toBe('online');
  });

  it('stops being idle when an active connection is left', async () => {
    const idle = await connect();
    const active = await connect();
    await gateway.setIdle(idle, true);

    await gateway.handleDisconnect(active);
    expect(gateway.statusOf(7, visible)).toBe('idle');

    await gateway.handleDisconnect(idle);
    expect(gateway.statusOf(7, visible)).toBe('offline');
  });
});
