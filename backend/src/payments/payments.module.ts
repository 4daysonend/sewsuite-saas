import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookController } from './controllers/webhook.controller';
import { CheckoutController } from './controllers/checkout.controller';
import { PaymentsService } from './services/payments.service';
import { StripeService } from './services/stripe.service';
import { Payment } from './entities/payment.entity';
import { Subscription } from './entities/subscription.entity';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Subscription]),
    CommonModule,
    ConfigModule,
  ],
  controllers: [CheckoutController, WebhookController],
  providers: [PaymentsService, StripeService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
