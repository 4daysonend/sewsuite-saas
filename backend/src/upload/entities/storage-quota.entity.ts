import { Entity, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../users/entities/user.entity';
import { FileCategory } from './file.entity';

/**
 * Entity for tracking user storage quotas
 */
@Entity('storage_quotas')
export class StorageQuota extends BaseEntity {
  /**
   * User this quota belongs to
   */
  @OneToOne(() => User)
  @JoinColumn()
  @Index()
  user!: User;

  /**
   * Total allocated space in bytes
   */
  @Column('bigint')
  totalSpace = 0;

  /**
   * Currently used space in bytes
   */
  @Column('bigint')
  usedSpace = 0;

  /**
   * Quota allocation by file category (in bytes)
   */
  @Column({ type: 'jsonb', nullable: true })
  quotaByCategory?: Record<FileCategory, number>;

  /**
   * Last quota update timestamp
   */
  @Column({ type: 'timestamptz', nullable: true })
  lastQuotaUpdate?: Date;

  /**
   * Quota reset date (for billing cycles)
   */
  @Column({ type: 'timestamptz', nullable: true })
  nextResetDate?: Date;

  /**
   * Whether user can exceed quota temporarily
   */
  @Column({ default: false })
  canExceedQuota = false;

  /**
   * Maximum allowed overage in bytes
   */
  @Column('bigint', { default: 0 })
  maxOverage = 0;

  constructor(partial: Partial<StorageQuota>) {
    super();
    Object.assign(this, partial);
  }

  /**
   * Get available space in bytes
   */
  get availableSpace(): number {
    return Math.max(0, this.totalSpace - this.usedSpace);
  }

  /**
   * Get usage percentage
   */
  get usagePercentage(): number {
    return this.totalSpace > 0 ? (this.usedSpace / this.totalSpace) * 100 : 0;
  }

  /**
   * Check if quota is exceeded
   */
  isQuotaExceeded(): boolean {
    if (this.canExceedQuota) {
      return this.usedSpace > this.totalSpace + this.maxOverage;
    }
    return this.usedSpace >= this.totalSpace;
  }

  /**
   * Calculate remaining days until quota reset
   */
  get daysUntilReset(): number | null {
    if (!this.nextResetDate) return null;
    
    const now = new Date();
    const resetDate = new Date(this.nextResetDate);
    const diffTime = resetDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }
}