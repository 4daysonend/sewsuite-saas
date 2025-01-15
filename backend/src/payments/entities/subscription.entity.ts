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
  stripeSubscriptionId: string;

  @Column()
  stripePriceId: string;

  @Column()
  stripeCustomerId: string;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.INCOMPLETE,
  })
  status: SubscriptionStatus;

  @Column()
  currentPeriodStart: Date;

  @Column()
  currentPeriodEnd: Date;

  @Column({ nullable: true })
  canceledAt: Date;

  @Column({ default: false })
  cancelAtPeriodEnd: boolean;

  @ManyToOne(() => User, (user) => user.subscriptions)
  user: User;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
