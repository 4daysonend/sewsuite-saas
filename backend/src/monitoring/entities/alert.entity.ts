import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  UpdateDateColumn,
} from 'typeorm';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column()
  @Index()
  title: string;

  @Column('text')
  message: string;

  @Column()
  @Index()
  severity: 'low' | 'medium' | 'high' | 'critical';

  @Column()
  @Index()
  status: 'active' | 'acknowledged' | 'resolved';

  @Column({ nullable: true })
  @Index()
  component?: string;

  @Column({ nullable: true })
  source?: string;

  @CreateDateColumn()
  @Index()
  timestamp: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  acknowledgedBy?: string;

  @Column({ nullable: true })
  acknowledgedAt?: Date;

  @Column({ nullable: true })
  resolvedBy?: string;

  @Column({ nullable: true })
  resolvedAt?: Date;

  @Column('json', { nullable: true })
  metadata?: Record<string, any>;

  @Column({ default: 1 })
  count: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastOccurrence: Date;

  @Column({ nullable: true })
  type: string;
}
