// /backend/src/orders/entities/order.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { User } from '../../users/entities/user.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { File } from '../../upload/entities/file.entity';
import { BaseEntity } from '../../common/entities/base.entity';

export enum OrderStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED', // Payment confirmed status
  PAYMENT_FAILED = 'PAYMENT_FAILED', // Payment failed status
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PENDING_PAYMENT = 'pending_payment',
  PAYMENT_FAILED = 'payment_failed',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('orders')
export class Order extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  declare id: string;

  @Column()
  clientId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'clientId' })
  client: User;

  @Column({ nullable: true })
  tailorId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'tailorId' })
  tailor: User;

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
  payments: Payment[];

  @OneToMany(() => File, (file) => file.order)
  attachments!: File[];

  @OneToMany(() => OrderItem, (orderItem) => orderItem.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItem[];

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @CreateDateColumn()
  declare createdAt: Date;

  @UpdateDateColumn()
  declare updatedAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any> = {};

  @Column({ nullable: true })
  cancellationReason?: string;

  @Column({ type: 'timestamp', nullable: true })
  cancelledAt?: Date;

  @Column({ nullable: true })
  cancelledBy?: string;

  constructor(partial: Partial<Order>) {
    super();
    Object.assign(this, partial);
  }

  get itemCount(): number {
    return this.items ? this.items.length : 0;
  }
}
