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
    @MessageBody() body: { conversationId?: unknown; typing?: unknown } | null,
  ) {
    const userId: number | undefined = client.data.userId;
    const conversationId = body?.conversationId;
    if (userId === undefined || !Number.isInteger(conversationId)) return;

    await this.messages
      .typing(userId, conversationId as number, body?.typing === true)
      .catch(() => null);
  }
}
