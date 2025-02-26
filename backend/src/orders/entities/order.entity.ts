// /backend/src/orders/entities/order.entity.ts
import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { File } from '../../upload/entities/file.entity';
import { BaseEntity } from '../../common/base.entity';

export enum OrderStatus {
  DRAFT = 'draft',
  PENDING_PAYMENT = 'pending_payment',
  PAYMENT_FAILED = 'payment_failed',
  CONFIRMED = 'confirmed',
  IN_PROGRESS = 'in_progress',
  READY_FOR_FITTING = 'ready_for_fitting',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('orders')
export class Order extends BaseEntity {
  @ManyToOne(() => User, (user) => user.clientOrders, { nullable: false })
  client!: User;

  @ManyToOne(() => User, (user) => user.tailorOrders, { nullable: false })
  tailor!: User;

  @Column('enum', { enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus = OrderStatus.DRAFT;

  @Column('enum', { enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus = PaymentStatus.PENDING;

  @Column('jsonb')
  measurements: Record<string, number> = {};

  @Column('text')
  description = '';

  @Column('decimal', { precision: 10, scale: 2 })
  price = 0;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate?: Date;

  @Column('jsonb', { nullable: true })
  fabricDetails?: {
    type: string;
    color: string;
    quantity: number;
    additionalNotes?: string;
  };

  @Column('jsonb', { nullable: true })
  services?: Array<{
    type: string;
    price: number;
    description?: string;
  }>;

  @OneToMany(() => Payment, (payment) => payment.order)
  payments!: Payment[];

  @OneToMany(() => File, (file) => file.order)
  attachments!: File[];

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any> = {};

  constructor(partial: Partial<Order>) {
    super();
    Object.assign(this, partial);
  }
}