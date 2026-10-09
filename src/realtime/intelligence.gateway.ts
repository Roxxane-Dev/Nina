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
import { AuthService } from '../auth/auth.service';
import { FinancialEvent } from '../events/event.types';

/** Room name for a user's private channel. Never derived from client input. */
export const userRoom = (userId: string) => `user:${userId}`;

/**
 * Pushes financial events to the owning user only.
 *
 * The client must send its Supabase access token in the handshake
 * (`auth: { token }` or an `Authorization: Bearer` header). The userId comes
 * from the validated token — a client-supplied userId is ignored.
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: 'intelligence',
})
export class IntelligenceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(IntelligenceGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly authService: AuthService) {}

  async handleConnection(client: Socket) {
    const token = extractToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const user = await this.authService.validateToken(token);
      client.data.userId = user.id;
      await client.join(userRoom(user.id));
    } catch {
      this.logger.warn(`[WS] rejected connection ${client.id}: invalid token`);
      client.disconnect(true);
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
    if (!event?.userId || !this.server) return;
    this.server.to(userRoom(event.userId)).emit('intelligence_update', event);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket, data: any) {
    return { event: 'pong', data };
  }
}

function extractToken(client: Socket): string | null {
  const fromAuth = client.handshake.auth?.token;
  if (typeof fromAuth === 'string' && fromAuth.trim()) return fromAuth.trim();
  const header = client.handshake.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7).trim() || null;
  }
  return null;
}
