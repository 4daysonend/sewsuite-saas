// src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health';
import { BullHealthIndicator } from './indicators/bull.health';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    BullModule.registerQueue({ name: 'email' }, { name: 'upload' }),
  ],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, BullHealthIndicator],
})
export class HealthModule {}
