import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { MessagesService } from './messages.service';

@WebSocketGateway({ cors: true })
export class MessagesGateway {
  constructor(private messages: MessagesService) {}

  @SubscribeMessage('typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { userId?: unknown; typing?: unknown } | null,
  ) {
    const userId: number | undefined = client.data.userId;
    const otherId = body?.userId;
    if (userId === undefined || !Number.isInteger(otherId)) return;

    await this.messages
      .typing(userId, otherId as number, body?.typing === true)
      .catch(() => null);
  }
}
