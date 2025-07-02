import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppLoggerService } from './services/app-logger.service';

@Module({
  imports: [ConfigModule],
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class CommonModule {}
