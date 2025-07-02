import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('system_metrics')
export class SystemMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cpuUsage: string;

  @Column()
  memoryUsage: string;

  @Column({ nullable: true })
  diskUsage?: string;

  @Column('int', { nullable: true })
  activeConnections?: number;

  @CreateDateColumn()
  timestamp: Date;
}
