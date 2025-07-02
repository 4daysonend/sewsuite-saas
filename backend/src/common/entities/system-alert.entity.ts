import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { AlertSeverity, AlertCategory } from '../services/alert.service';

export enum AlertStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
  ACKNOWLEDGED = 'acknowledged',
  OPEN = 'open',
  IGNORED = 'ignored',
}

@Entity('system_alerts')
export class SystemAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.INFO,
  })
  @Index()
  severity: AlertSeverity;

  @Column({
    type: 'enum',
    enum: AlertCategory,
    default: AlertCategory.SYSTEM,
  })
  @Index()
  category: AlertCategory;

  @Column()
  title: string;

  @Column()
  message: string;

  @Column({ type: 'jsonb', default: '{}' })
  details: Record<string, any>;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column({ default: 'system' })
  source: string;

  @Column({ default: false })
  @Index()
  requiresAction: boolean;

  @Column({ default: false })
  @Index()
  actionTaken: boolean;

  @Column({ nullable: true })
  resolvedAt: Date;

  @Column({ nullable: true })
  resolvedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  resolvedDetails: Record<string, any>;

  @Column({ default: false })
  notificationSent: boolean;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column({ nullable: true })
  component: string;

  @Column()
  @CreateDateColumn()
  timestamp: Date;

  @Column({ nullable: true })
  resolutionMessage: string;

  @Column({ nullable: true, type: 'timestamp' })
  resolutionTimestamp: Date;

  @CreateDateColumn()
  @Index()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
