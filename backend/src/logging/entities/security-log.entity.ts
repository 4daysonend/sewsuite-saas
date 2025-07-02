import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('security_logs')
export class SecurityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  action: string;

  @Column({ nullable: true })
  @Index()
  userId?: string;

  @Column({ nullable: true })
  @Index()
  targetId?: string;

  @Column({ nullable: true })
  @Index()
  targetType?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @Column({ nullable: true })
  userAgent?: string;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @Column({ nullable: true })
  @Index()
  status?: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
