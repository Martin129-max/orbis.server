import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma.service';

const room = (userId: number) => `user:${userId}`;

@WebSocketGateway({ cors: true })
export class PresenceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connections = new Map<number, number>();

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    let userId: number;
    try {
      ({ sub: userId } = await this.jwt.verifyAsync(
        client.handshake.auth?.token,
      ));
    } catch {
      client.disconnect(true);
      return;
    }

    if (!client.connected) return;

    client.data.userId = userId;
    await client.join(room(userId));

    const count = (this.connections.get(userId) ?? 0) + 1;
    this.connections.set(userId, count);
    if (count === 1) await this.broadcastPresence(userId);
  }

  async handleDisconnect(client: Socket) {
    const userId: number | undefined = client.data.userId;
    if (userId === undefined) return;

    const count = (this.connections.get(userId) ?? 1) - 1;
    if (count > 0) {
      this.connections.set(userId, count);
      return;
    }

    this.connections.delete(userId);
    await this.broadcastPresence(userId);
  }

  isOnline(userId: number) {
    return this.connections.has(userId);
  }

  notify(userIds: number[], event: string) {
    this.server.to(userIds.map(room)).emit(event);
  }

  async broadcastPresence(userId: number) {
    const [user, friendships] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { appearOffline: true },
      }),
      this.prisma.friendship.findMany({
        where: {
          status: 'accepted',
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
        select: { requesterId: true, addresseeId: true },
      }),
    ]);

    if (!user || friendships.length === 0) return;

    const friendIds = friendships.map(({ requesterId, addresseeId }) =>
      requesterId === userId ? addresseeId : requesterId,
    );
    this.server.to(friendIds.map(room)).emit('presence', {
      userId,
      online: this.isOnline(userId) && !user.appearOffline,
    });
  }
}
