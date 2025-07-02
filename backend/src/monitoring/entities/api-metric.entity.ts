import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('api_metrics')
export class ApiMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  path: string;

  @Column()
  method: string;

  @Column()
  statusCode: number;

  @Column('float')
  responseTime: number;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  ipAddress?: string;

  @CreateDateColumn()
  @Index()
  timestamp: Date;

  @Column('json', { nullable: true })
  metadata?: Record<string, any>;
}
