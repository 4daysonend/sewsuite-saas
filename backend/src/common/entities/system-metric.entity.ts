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

  @Column('float')
  cpuUsage: number;

  @Column('int')
  cpuCores: number;

  @Column('jsonb')
  loadAverage: number[];

  @Column('int')
  memoryTotal: number;

  @Column('int')
  memoryUsed: number;

  @Column('int')
  memoryFree: number;

  @Column('float')
  memoryUsage: number;

  @Column('int')
  diskTotal: number;

  @Column('int')
  diskUsed: number;

  @Column('int')
  diskFree: number;

  @Column('float')
  diskUsage: number;

  @Column('int')
  networkBytesIn: number;

  @Column('int')
  networkBytesOut: number;

  @Column('int')
  networkConnections: number;

  @Column('int')
  uptime: number;

  @CreateDateColumn()
  timestamp: Date;
}
