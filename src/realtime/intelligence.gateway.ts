import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FinancialEvent, FinancialEventType } from '../events/event.types';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'intelligence',
})
export class IntelligenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(IntelligenceGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      client.join(userId);
      this.logger.log(`[WS CONNECTED] User ${userId} joined room.`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`[WS DISCONNECTED] Client ${client.id}`);
  }

  /**
   * Listens to internal financial events and pushes them to the respective user via WS.
   */
  @OnEvent('**') // Listen to all events
  handleFinancialEvent(event: FinancialEvent) {
    this.logger.log(`[WS PUSH] Emitting ${event.type} to user ${event.userId}`);
    this.server.to(event.userId).emit('intelligence_update', event);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket, data: any) {
    return { event: 'pong', data };
  }
}
