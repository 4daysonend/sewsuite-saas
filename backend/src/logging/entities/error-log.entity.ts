import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('error_logs')
export class ErrorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  source: string;

  @Column('text')
  message: string;

  @Column('text', { nullable: true })
  stack?: string;

  @Column({ nullable: true })
  @Index()
  userId?: string;

  @Column('jsonb', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
