// /backend/src/monitoring/gateways/monitoring.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsGuard } from '../../common/guards/ws.guard';
import { MonitoringService } from '../monitoring.service';

@WebSocketGateway({
  namespace: 'monitoring',
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
})
export class MonitoringGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private clients: Map<string, { userId: string; timeframe: string }> =
    new Map();

  constructor(private readonly monitoringService: MonitoringService) {}

  @UseGuards(WsGuard)
  async handleConnection(client: Socket): Promise<void> {
    const userId = client.handshake.auth.userId;
    this.clients.set(client.id, { userId, timeframe: '1h' });
    await this.sendInitialData(client);
  }

  handleDisconnect(client: Socket): void {
    this.clients.delete(client.id);
  }

  @SubscribeMessage('setTimeframe')
  async handleTimeframeChange(
    client: Socket,
    timeframe: string,
  ): Promise<void> {
    const clientData = this.clients.get(client.id);
    if (clientData) {
      this.clients.set(client.id, { ...clientData, timeframe });
      await this.sendMetricsUpdate(client);
    }
  }

  private async sendInitialData(client: Socket): Promise<void> {
    const clientData = this.clients.get(client.id);
    if (clientData) {
      const metrics = await this.monitoringService.getMetrics(
        clientData.timeframe,
      );
      client.emit('metrics', metrics);
    }
  }

  private async sendMetricsUpdate(client: Socket): Promise<void> {
    const clientData = this.clients.get(client.id);
    if (clientData) {
      const metrics = await this.monitoringService.getMetrics(
        clientData.timeframe,
      );
      client.emit('metrics', metrics);
    }
  }

  async broadcastMetricsUpdate(): Promise<void> {
    for (const [clientId, clientData] of this.clients.entries()) {
      const client = this.server.sockets.sockets.get(clientId);
      if (client) {
        await this.sendMetricsUpdate(client);
      }
    }
  }
}