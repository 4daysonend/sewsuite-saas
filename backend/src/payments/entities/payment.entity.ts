// /backend/src/payments/entities/payment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity'; // Adjust the path as needed

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Add this property to store Stripe details
  @Column({ type: 'json', nullable: true })
  stripeDetails?: any;

  @Column({ nullable: true })
  stripeCustomerId?: string;

  @Column({ nullable: true })
  stripePaymentIntentId?: string;

  @Column({ nullable: true })
  stripeChargeId?: string;

  @Column({ nullable: true })
  stripeInvoiceId?: string;

  @Column({ nullable: true })
  stripeSubscriptionId?: string;

  @Column({ nullable: true })
  paymentMethodId?: string;

  @Column({ nullable: true })
  relatedPaymentId?: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  amount?: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ length: 20 })
  status: string; // succeeded, failed, refunded, partially_refunded, etc.

  @Column({ nullable: true })
  errorMessage?: string;

  @Column({ nullable: true })
  errorCode?: string;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  refundedAmount?: number;

  @Column({ nullable: true })
  userId?: string;

  // Refund-related properties
  @Column({ default: false })
  refunded: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  refundedAt?: Date;

  @Column({ nullable: true })
  refundReason?: string;

  @Column({ nullable: true })
  refundId?: string;

  @Column({ nullable: true })
  orderId?: string;

  // Add this relation
  @ManyToOne(() => Order, (order) => order.payments)
  @JoinColumn({ name: 'orderId' })
  order?: Order;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
