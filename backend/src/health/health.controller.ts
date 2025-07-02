import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  HealthCheckService,
  HttpHealthIndicator,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
  HealthCheck,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator';
import { RedisHealthIndicator } from './indicators/redis.health';
import { BullHealthIndicator } from './indicators/bull.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private readonly configService: ConfigService,
    private readonly redis: RedisHealthIndicator,
    private readonly bullQueue: BullHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Check basic system health' })
  check() {
    return this.health.check([
      // Database connectivity check
      async () => this.db.pingCheck('database', { timeout: 3000 }),

      // Memory usage check
      async () => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024), // 250MB max heap
      async () => this.memory.checkRSS('memory_rss', 512 * 1024 * 1024), // 512MB max RSS

      // Disk space check
      async () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9, // 90% max storage usage
        }),

      // Redis connectivity check
      async () => this.redis.checkHealth('redis'),

      // Queue health check - UPDATED
      async () => this.bullQueue.check('queue'), // Changed from checkHealth to check
    ]);
  }

  @Get('/db')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Check database health' })
  checkDatabase() {
    return this.health.check([
      async () => this.db.pingCheck('database', { timeout: 3000 }),
    ]);
  }

  @Get('/redis')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Check Redis health' })
  checkRedis() {
    return this.health.check([async () => this.redis.checkHealth('redis')]);
  }

  @Get('/queue')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Check queue health' })
  checkQueue() {
    return this.health.check([
      // UPDATED
      async () => this.bullQueue.check('queue'), // Changed from checkHealth to check
    ]);
  }

  @Get('/external')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Check external service health' })
  checkExternal() {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const s3Endpoint =
      this.configService.get<string>('S3_ENDPOINT') ||
      'https://s3.amazonaws.com';

    return this.health.check([
      // Frontend availability check
      async () => {
        if (!frontendUrl) {
          // Return a valid HealthIndicatorResult directly
          return {
            frontend: {
              status: 'up', // Required by NestJS Terminus
              skipped: true,
              message: 'No frontend URL configured',
            },
          };
        }
        // If URL is available, perform normal check
        return this.http.pingCheck('frontend', frontendUrl, { timeout: 3000 });
      },

      // S3/MinIO availability check
      async () => this.http.pingCheck('storage', s3Endpoint, { timeout: 5000 }),
    ]);
  }

  @Get('/liveness')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Simple liveness check' })
  async liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
