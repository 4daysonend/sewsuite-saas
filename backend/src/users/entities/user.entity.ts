/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Entity,
  Column,
  Index,
  BaseEntity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  OneToMany,
} from 'typeorm';
import { IsEmail } from 'class-validator';
import { Exclude, Expose, Transform } from 'class-transformer';
import { UserRole } from '../enums/user-role.enum';
import { Subscription } from '../entities/subscription.entity';
import { UserPreferencesDto } from '../dto/user-preferences.dto';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timeZone?: string;
  currency?: string;
  notifications?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    marketing?: boolean;
    orderUpdates?: boolean;
  };
  features?: Record<string, boolean>;
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['googleId'], { unique: true, where: 'google_id IS NOT NULL' })
@Index(['stripeCustomerId'], {
  unique: true,
  where: 'stripe_customer_id IS NOT NULL',
})
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @Column({ nullable: true }) // Only nullable for OAuth users
  @Exclude({ toPlainOnly: true })
  password?: string;

  @Column({ nullable: true, name: 'google_id' })
  googleId?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CLIENT,
  })
  role: UserRole = UserRole.CLIENT;

  @Column({ nullable: true })
  locale?: string;

  @Column({ type: 'jsonb', default: {} })
  preferences: UserPreferencesDto;

  @Column({ nullable: true, name: 'stripe_customer_id' })
  stripeCustomerId?: string;

  @Column({ nullable: true })
  stripeConnectAccountId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  oauthProvider?: string;

  @Column({ nullable: true })
  oauthProviderId?: string;

  @Column({ nullable: true })
  @Exclude({ toPlainOnly: true })
  emailVerificationToken?: string;

  @Column({ nullable: true })
  @Exclude({ toPlainOnly: true })
  passwordResetToken?: string;

  @Column({ nullable: true, type: 'timestamp' })
  passwordResetExpires?: Date;

  @Column({ nullable: true })
  phoneNumber?: string;

  @Column({ nullable: true })
  profilePicture?: string;

  @Column({ nullable: true, type: 'timestamp' })
  lastLoginAt?: Date;

  @OneToMany(() => Subscription, (subscription) => subscription.user)
  subscriptions: Subscription[];

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens: RefreshToken[];

  @Expose()
  get displayRole(): string {
    return this.role.charAt(0).toUpperCase() + this.role.slice(1);
  }

  hasCompletedProfile(): boolean {
    return !!(
      this.firstName &&
      this.lastName &&
      this.email &&
      this.emailVerified
    );
  }

  canAccessTailorFeatures(): boolean {
    return (
      this.role === UserRole.TAILOR &&
      this.emailVerified &&
      !!this.stripeConnectAccountId
    );
  }

  hasStripeSetup(): boolean {
    return !!(this.stripeCustomerId || this.stripeConnectAccountId);
  }

  isPasswordResetTokenValid(): boolean {
    if (!this.passwordResetToken || !this.passwordResetExpires) {
      return false;
    }
    return this.passwordResetExpires > new Date();
  }

  @BeforeInsert()
  emailToLowerCase() {
    this.email = this.email.toLowerCase();
  }

  @Expose()
  get fullName(): string {
    return this.firstName && this.lastName
      ? `${this.firstName} ${this.lastName}`
      : this.firstName || this.lastName || '';
  }

  toJSON() {
    const {
      password: _password,
      emailVerificationToken,
      passwordResetToken,
      passwordResetExpires,
      ...rest
    } = this;
    return rest;
  }
}
export { UserRole };
