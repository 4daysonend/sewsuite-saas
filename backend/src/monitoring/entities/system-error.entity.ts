// /backend/src/monitoring/entities/system-error.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('system_errors')
export class SystemError {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column()
  message: string;

  @Column({ nullable: true })
  stack?: string;

  @Column({ nullable: true })
  component?: string;

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  requestPath?: string;

  @Column({ nullable: true })
  requestMethod?: string;

  @Column('json', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;
}
