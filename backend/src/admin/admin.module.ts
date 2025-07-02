import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule, // Import AuthModule to get access to JwtAuthGuard and RolesGuard
  ],
  controllers: [AdminController],
})
export class AdminModule {}
