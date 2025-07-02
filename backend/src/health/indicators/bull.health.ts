import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class BullHealthIndicator extends HealthIndicator {
  private readonly queueNames: string[];
  private readonly queues: Map<string, Queue>;

  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('upload') private readonly uploadQueue: Queue,
  ) {
    super();
    this.queueNames = ['email', 'upload'];

    // Create a map for easy access to queues by name
    this.queues = new Map();
    this.queues.set('email', this.emailQueue);
    this.queues.set('upload', this.uploadQueue);
  }

  /**
   * Check health of all Bull queues
   */
  async check(key: string = 'bull'): Promise<HealthIndicatorResult> {
    const results: Record<string, any> = {};
    let isHealthy = true;

    // Use the queueNames property to loop through all queues
    for (const queueName of this.queueNames) {
      try {
        const queue = this.queues.get(queueName);
        if (!queue) {
          throw new Error(`Queue ${queueName} not found`);
        }

        // Test connection
        const client = queue.client;
        const isConnected = (await client.ping()) === 'PONG';

        // Get additional queue stats
        const counts = await queue.getJobCounts();

        results[queueName] = {
          status: isConnected ? 'up' : 'down',
          jobs: counts,
        };

        if (!isConnected) {
          isHealthy = false;
        }
      } catch (error) {
        results[queueName] = {
          status: 'down',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        isHealthy = false;
      }
    }

    const status = this.getStatus(key, isHealthy, {
      queues: results,
    });

    if (!isHealthy) {
      throw new HealthCheckError('Bull queue check failed', status);
    }

    return status;
  }

  // Rest of your methods remain unchanged
  async checkEmailQueue(): Promise<HealthIndicatorResult> {
    return this.checkQueue('email');
  }

  async checkUploadQueue(): Promise<HealthIndicatorResult> {
    return this.checkQueue('upload');
  }

  private async checkQueue(queueName: string): Promise<HealthIndicatorResult> {
    try {
      const queue = this.queues.get(queueName);
      if (!queue) {
        // Use the parent class's getStatus method
        return this.getStatus(queueName, false, {
          message: `Queue ${queueName} not found`,
        });
      }

      // Ping the Redis connection through the queue
      const client = queue.client;
      const isConnected = (await client.ping()) === 'PONG';

      // Use the parent class's getStatus method
      return this.getStatus(queueName, isConnected);
    } catch (error) {
      // Use the parent class's getStatus method
      return this.getStatus(queueName, false, {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
