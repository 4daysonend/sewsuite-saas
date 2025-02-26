import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { RefundService } from './refund.service';
import { SubscriptionService } from './subscription.service';
import { PaymentAnalyticsService } from './analytics.service';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { OrdersModule } from '../orders/orders.module';
import { EmailModule } from '../email/email.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment, Subscription]),
    OrdersModule,
    EmailModule,
    UsersModule,
  ],
  providers: [
    PaymentsService,
    RefundService,
    SubscriptionService,
    PaymentAnalyticsService,
  ],
  exports: [
    PaymentsService,
    RefundService,
    SubscriptionService,
    PaymentAnalyticsService,
  ],
})
export class PaymentsModule {}