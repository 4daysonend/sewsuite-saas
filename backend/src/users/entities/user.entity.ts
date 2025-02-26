import {
  Entity,
  Column,
  OneToMany,
  Index,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad
} from 'typeorm';
import { Exclude, Expose } from 'class-transformer';
import { IsEmail, IsPhoneNumber } from 'class-validator';
import { BaseEntity } from '../../common/base.entity';
import { Order } from '../../orders/entities/order.entity';
import { File } from '../../upload/entities/file.entity';
import { Subscription } from '../../payments/entities/subscription.entity';

export enum UserRole {
  ADMIN = 'admin',
  TAILOR = 'tailor',
  CLIENT = 'client',
}

export interface UserPreferences {
  theme?: 'light' | 'dark';
  notifications?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
  language?: string;
  timeZone?: string;
  currency?: string;
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['googleId'], { unique: true, where: "google_id IS NOT NULL" })
@Index(['stripeCustomerId'], { unique: true, where: "stripe_customer_id IS NOT NULL" })
export class User extends BaseEntity {
  @Column()
  @IsEmail()
  @Index({ unique: true })
  email = '';

  @Column({ nullable: true })
  @Exclude()
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
  firstName?: string;

  @Column({ nullable: true })
  lastName?: string;

  @Column({ nullable: true })
  @IsPhoneNumber()
  phoneNumber?: string;

  @Column({ nullable: true, type: 'text' })
  address?: string;

  @Column({ default: false })
  emailVerified = false;

  @Column({ nullable: true })
  @Exclude()
  emailVerificationToken?: string;

  @Column({ nullable: true })
  @Exclude()
  passwordResetToken?: string;

  @Column({ type: 'timestamptz', nullable: true })
  @Exclude()
  passwordResetExpires?: Date;

  @OneToMany(() => Order, (order: Order) => order.client)
  clientOrders!: Order[];

  @OneToMany(() => Order, (order: Order) => order.tailor)
  tailorOrders!: Order[];

  @OneToMany(() => File, (file: File) => file.uploader)
  uploads!: File[];

  @OneToMany(() => Subscription, (subscription: Subscription) => subscription.user)
  subscriptions!: Subscription[];
  
  @Column({ nullable: true, name: 'stripe_customer_id' })
  @Exclude()
  stripeCustomerId?: string;

  @Column({ nullable: true, name: 'stripe_connect_account_id' })
  @Exclude()
  stripeConnectAccountId?: string;

  @Column({ default: true })
  isActive = true;

  @Column({ type: 'jsonb', nullable: true })
  preferences: UserPreferences = {};

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  // Virtual properties
  private tempFullName?: string;

  constructor(partial: Partial<User>) {
    super();
    Object.assign(this, partial);
  }

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
  }

  @AfterLoad()
  computeFullName() {
    this.tempFullName = this.getFullName();
  }

  @Expose()
  get fullName(): string {
    return this.tempFullName || this.getFullName();
  }

  getFullName(): string {
    if (this.firstName && this.lastName) {
      return `${this.firstName} ${this.lastName}`.trim();
    }
    if (this.firstName) {
      return this.firstName;
    }
    if (this.lastName) {
      return this.lastName;
    }
    return this.email;
  }

  @Expose()
  get isSubscribed(): boolean {
    if (!this.subscriptions?.length) {
      return false;
    }
    return this.subscriptions.some(sub => 
      sub.status === 'active' && (!sub.expiresAt || sub.expiresAt > new Date())
    );
  }

  @Expose()
  get displayRole(): string {
    return this.role.charAt(0).toUpperCase() + this.role.slice(1);
  }

  hasCompletedProfile(): boolean {
    return !!(
      this.firstName &&
      this.lastName &&
      this.phoneNumber &&
      this.address &&
      this.emailVerified
    );
  }

  canAccessTailorFeatures(): boolean {
    return this.role === UserRole.TAILOR && 
           this.emailVerified && 
           !!this.stripeConnectAccountId;
  }

  hasStripeSetup(): boolean {
    return !!(this.stripeCustomerId || this.stripeConnectAccountId);
  }

  isPasswordResetTokenValid(): boolean {
    if (!this.passwordResetToken || !this.passwordResetExpires) {
      return false;
    }
    return new Date() < this.passwordResetExpires;
  }

  toJSON() {
    const { 
      password,
      emailVerificationToken,
      passwordResetToken,
      passwordResetExpires,
      stripeCustomerId,
      stripeConnectAccountId,
      ...safeUser 
    } = this;
    return safeUser;
  }
}