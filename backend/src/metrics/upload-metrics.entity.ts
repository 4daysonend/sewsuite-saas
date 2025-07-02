import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('upload_metrics')
export class UploadMetrics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  fileId: string;

  @Column()
  @Index()
  userId: string;

  @Column()
  fileType: string;

  @Column()
  fileSize: number;

  @Column()
  processingTimeMs: number;

  @Column()
  @Index()
  status: 'success' | 'failed';

  @Column({ nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  @Index()
  createdAt: Date;
}
