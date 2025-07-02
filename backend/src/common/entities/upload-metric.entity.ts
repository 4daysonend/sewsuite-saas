import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('upload_metrics')
export class UploadMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  fileName: string;

  @Column('int')
  fileSize: number;

  @Column()
  @Index()
  fileType: string;

  @Column({ nullable: true })
  processingTime: number;

  @Column('boolean', { default: true })
  success: boolean;

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  @Index()
  timestamp: Date;
}
