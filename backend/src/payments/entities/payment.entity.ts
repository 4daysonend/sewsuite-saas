// /backend/src/payments/entities/payment.entity.ts
import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { Order } from '../../orders/entities/order.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('payments')
export class Payment extends BaseEntity {
  @Column()
  stripePaymentIntentId = '';

  @Column('decimal', { precision: 10, scale: 2 })
  amount = 0;

  @Column()
  currency = 'USD';

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus = PaymentStatus.PENDING;

  @ManyToOne(() => Order, (order) => order.payments)
  order: Order;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> = {};

  constructor(partial: Partial<Payment>) {
    super();
    Object.assign(this, partial);
  }
}