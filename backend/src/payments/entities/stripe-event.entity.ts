// src/entities/stripe-event.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('stripe_events')
export class StripeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  stripeEventId: string;

  @Column({ nullable: true })
  type: string;

  @Column({ default: false })
  processed: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  processedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
