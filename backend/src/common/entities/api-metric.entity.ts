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
  @Index()
  method: string;

  @Column('int')
  statusCode: number;

  @Column('int')
  responseTime: number;

  @Column({ nullable: true })
  @Index()
  userId: string;

  @Column('jsonb', { nullable: true })
  requestParams: Record<string, any>;

  @CreateDateColumn()
  @Index()
  timestamp: Date;
}
