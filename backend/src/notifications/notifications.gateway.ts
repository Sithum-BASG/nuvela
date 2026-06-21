import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AuthTokenPayload } from '../auth/token.service';
import { parseAccessTokenFromCookie } from './ws-auth.util';

type NotificationSocket = Socket & {
  data: { userId?: string };
};

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: NotificationSocket): Promise<void> {
    const token = parseAccessTokenFromCookie(client.handshake.headers.cookie);

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthTokenPayload>(
        token,
        { secret: this.configService.getOrThrow('JWT_ACCESS_SECRET') },
      );
      const socketData = client.data as { userId?: string };
      socketData.userId = payload.sub;
      void client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitToUser(userId: string, event: 'notification', payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
