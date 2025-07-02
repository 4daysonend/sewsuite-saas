import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  @Index()
  action: string;

  @Column()
  @Index()
  resourceType: string;

  @Column({ nullable: true })
  @Index()
  resourceId?: string;

  @Column('jsonb', { nullable: true })
  details?: Record<string, any>;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
