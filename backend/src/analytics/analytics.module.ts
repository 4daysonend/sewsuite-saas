import { Module } from '@nestjs/common';
import { UserAnalyticsService } from './user-analytics.service';

@Module({
  providers: [UserAnalyticsService],
  exports: [UserAnalyticsService],
})
export class AnalyticsModule {}
