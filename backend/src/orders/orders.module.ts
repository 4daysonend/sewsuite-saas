import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './controllers/orders.controller';
import { OrderAnalyticsController } from './controllers/order-analytics.controller';
import { OrdersService } from './services/orders.service';
import { OrderAnalyticsService } from './services/order-analytics.service';
import { OrderRepository } from './repositories/order.repository';
import { PaymentsModule } from '../payments/payments.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderRepository]),
    PaymentsModule,
    EmailModule,
    UsersModule
  ],
  controllers: [OrdersController, OrderAnalyticsController],
  providers: [OrdersService, OrderAnalyticsService],
  exports: [OrdersService, OrderAnalyticsService]
})
export class OrdersModule {}