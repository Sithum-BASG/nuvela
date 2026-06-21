import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Socket } from 'socket.io';
import type { AuthTokenPayload } from '../auth/token.service';
import { NotificationsGateway } from './notifications.gateway';

type MockClient = {
  handshake: { headers: { cookie?: string } };
  data: { userId?: string };
  join: jest.Mock;
  disconnect: jest.Mock;
};

describe('NotificationsGateway', () => {
  const payload: AuthTokenPayload = {
    sub: 'user-1',
    role: Role.COLLABORATOR,
    organizationId: 'org-1',
  };

  const createGateway = () => {
    const verifyAsync = jest.fn();
    const jwtService = { verifyAsync } as unknown as JwtService;
    const configService = {
      getOrThrow: jest.fn().mockReturnValue('test-secret'),
    } as unknown as ConfigService;
    const gateway = new NotificationsGateway(jwtService, configService);
    return { gateway, verifyAsync };
  };

  const createClient = (cookie?: string): MockClient => ({
    handshake: { headers: { cookie } },
    data: {},
    join: jest.fn(),
    disconnect: jest.fn(),
  });

  it('disconnects when no cookie is present', async () => {
    const { gateway } = createGateway();
    const client = createClient();

    await gateway.handleConnection(client as unknown as Socket);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('disconnects when the access token is invalid', async () => {
    const { gateway, verifyAsync } = createGateway();
    const client = createClient('access_token=bad-token');
    verifyAsync.mockRejectedValue(new Error('invalid'));

    await gateway.handleConnection(client as unknown as Socket);

    expect(client.disconnect).toHaveBeenCalledWith(true);
    expect(client.join).not.toHaveBeenCalled();
  });

  it('joins user room when the access token is valid', async () => {
    const { gateway, verifyAsync } = createGateway();
    const client = createClient('access_token=valid-token');
    verifyAsync.mockResolvedValue(payload);

    await gateway.handleConnection(client as unknown as Socket);

    expect(client.data.userId).toBe(payload.sub);
    expect(client.join).toHaveBeenCalledWith(`user:${payload.sub}`);
    expect(client.disconnect).not.toHaveBeenCalled();
  });
});
