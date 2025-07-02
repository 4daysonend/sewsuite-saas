import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('file_uploads')
export class FileUpload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column({ nullable: true })
  originalFilename?: string;

  @Column()
  mimeType: string;

  @Column('int')
  size: number;

  @Column({ nullable: true })
  path?: string;

  @Column({ nullable: true })
  bucket?: string;

  @Column({ nullable: true })
  userId?: string;

  @Column('json', { nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  processedAt?: Date;
}
