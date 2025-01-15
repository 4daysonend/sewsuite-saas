import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { EmailModule } from '../email/email.module';
import { Payment } from './entities/payment.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Payment]),
    OrdersModule,
    EmailModule,
  ],
  providers: [PaymentsService],
  controllers: [PaymentsController],
  exports: [PaymentsService],
})
export class PaymentsModule {}
