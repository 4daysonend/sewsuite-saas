import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'monitoring',
  cors: {
    origin: '*',
  },
})
export class MonitoringGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MonitoringGateway.name);

  @WebSocketServer() server: Server;

  afterInit() {
    this.logger.log('Monitoring WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast metrics update to all connected clients
   */
  async broadcastMetricsUpdate(metrics: any): Promise<void> {
    try {
      this.server.emit('metrics-update', {
        ...metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to broadcast metrics: ${(error as Error).message}`,
      );
    }
  }
}
