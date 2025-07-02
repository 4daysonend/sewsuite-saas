// /backend/src/payments/entities/subscription.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  stripeSubscriptionId: string;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ nullable: true })
  stripePriceId: string;

  @Column({ nullable: true })
  userId: string;

  // Add this relationship
  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: 'active' })
  status: string; // active, past_due, canceled, etc.

  // Add these properties
  @Column({ type: 'timestamp', nullable: true })
  currentPeriodStart: Date;

  @Column({ type: 'timestamp', nullable: true })
  currentPeriodEnd: Date;

  @Column({ nullable: true, type: 'timestamp' })
  canceledAt?: Date;

  @Column({ nullable: true, default: false })
  cancelAtPeriodEnd?: boolean;

  // Add this new property
  @Column({ nullable: true, type: 'text' })
  cancelReason?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>;

  // Add this field to store Stripe API data
  @Column({ type: 'json', nullable: true })
  stripeDetails?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
