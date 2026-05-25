import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { BusinessesService } from '../businesses/businesses.service';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../auth/auth.types';

interface SocketData {
  userId: string;
  role: UserRole;
}

function businessRoom(businessId: string): string {
  return `business:${businessId}`;
}

@WebSocketGateway({
  namespace: '/inbox',
  cors: { origin: '*', credentials: true },
})
export class InboxGateway
  implements OnModuleInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger(InboxGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly businesses: BusinessesService,
  ) {}

  onModuleInit(): void {
    // Authenticate every incoming socket connection. Reject if no/bad JWT.
    this.server.use((socket, next) => {
      try {
        const token = this.extractToken(socket);
        if (!token) return next(new Error('missing token'));
        const secret = this.config.get<string>('JWT_SECRET');
        if (!secret) return next(new Error('JWT_SECRET not set'));
        const payload = this.jwt.verify<JwtPayload>(token, { secret });
        (socket.data as SocketData) = {
          userId: payload.sub,
          role: payload.role,
        };
        return next();
      } catch (err) {
        return next(err as Error);
      }
    });
  }

  handleConnection(socket: Socket): void {
    const data = socket.data as SocketData;
    this.log.debug(`inbox connected user=${data?.userId}`);
  }

  handleDisconnect(socket: Socket): void {
    const data = socket.data as SocketData;
    this.log.debug(`inbox disconnected user=${data?.userId}`);
  }

  @SubscribeMessage('join:business')
  async joinBusiness(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { businessId?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const data = socket.data as SocketData;
    const businessId = body?.businessId;
    if (!businessId) return { ok: false, error: 'missing businessId' };

    if (data.role !== UserRole.GlobalAdmin) {
      const membership = await this.businesses.membership(
        businessId,
        data.userId,
      );
      if (!membership) return { ok: false, error: 'not a member' };
    }
    await socket.join(businessRoom(businessId));
    return { ok: true };
  }

  @SubscribeMessage('leave:business')
  async leaveBusiness(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { businessId?: string },
  ): Promise<{ ok: boolean }> {
    if (body?.businessId) {
      await socket.leave(businessRoom(body.businessId));
    }
    return { ok: true };
  }

  emitToBusiness(businessId: string, event: string, payload: unknown): void {
    this.server.to(businessRoom(businessId)).emit(event, payload);
  }

  private extractToken(socket: Socket): string | null {
    const auth = socket.handshake?.auth as { token?: string } | undefined;
    if (auth?.token) return auth.token;
    const header = socket.handshake?.headers?.authorization;
    if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
    const queryToken = socket.handshake?.query?.token;
    if (typeof queryToken === 'string') return queryToken;
    return null;
  }
}
