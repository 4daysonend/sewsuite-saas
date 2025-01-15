import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Payment } from '../../payments/entities/payment.entity';

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
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.clientOrders)
  client: User;

  @ManyToOne(() => User, (user) => user.tailorOrders)
  tailor: User;

  @Column('enum', { enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus;

  @Column('enum', { enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column('jsonb')
  measurements: Record<string, number>;

  @Column('text')
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date;

  @Column('jsonb', { nullable: true })
  fabricDetails: {
    type: string;
    color: string;
    quantity: number;
    additionalNotes?: string;
  };

  @Column('jsonb', { nullable: true })
  services: {
    type: string;
    price: number;
    description?: string;
  }[];

  @OneToMany(() => Payment, (payment) => payment.order)
  payments: Payment[];

  @Column('jsonb', { nullable: true })
  fittingSchedule: {
    date: Date;
    notes?: string;
    status: 'scheduled' | 'completed' | 'cancelled';
  }[];

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  stripePaymentIntentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;
}
