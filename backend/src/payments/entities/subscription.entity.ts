// /backend/src/payments/entities/subscription.entity.ts
import { Entity, Column, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../users/entities/user.entity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  INCOMPLETE = 'incomplete',
  INCOMPLETE_EXPIRED = 'incomplete_expired',
  TRIALING = 'trialing',
  UNPAID = 'unpaid',
}

@Entity('subscriptions')
export class Subscription extends BaseEntity {
  @Column()
  stripeSubscriptionId = '';

  @Column()
  stripePriceId = '';

  @Column()
  stripeCustomerId = '';

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.INCOMPLETE,
  })
  status: SubscriptionStatus = SubscriptionStatus.INCOMPLETE;

  @Column({ type: 'timestamptz' })
  currentPeriodStart: Date = new Date();

  @Column({ type: 'timestamptz' })
  currentPeriodEnd: Date = new Date();

  @Column({ type: 'timestamptz', nullable: true })
  canceledAt?: Date;

  @Column({ default: false })
  cancelAtPeriodEnd = false;

  @ManyToOne(() => User, { nullable: false })
  user!: User;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> = {};

  constructor(partial: Partial<Subscription & { user: User }>) {
    super();
    Object.assign(this, partial);
  }
}