import {
  Entity,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';

export enum FileCategory {
  MEASUREMENT = 'measurement',
  DESIGN = 'design',
  FABRIC = 'fabric',
  REFERENCE = 'reference',
  FITTING = 'fitting',
  PRODUCT = 'product',
  INVOICE = 'invoice',
  PROFILE = 'profile',
}

export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  FAILED = 'failed',
}

@Entity('files')
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column()
  size: number;

  @Column()
  path: string;

  @Column({ nullable: true })
  publicUrl: string;

  @Column({
    type: 'enum',
    enum: FileCategory,
  })
  category: FileCategory;

  @Column({
    type: 'enum',
    enum: FileStatus,
    default: FileStatus.PENDING,
  })
  status: FileStatus;

  @ManyToOne(() => User, (user) => user.uploads)
  uploader: User;

  @ManyToOne(() => Order, (order) => order.attachments, { nullable: true })
  order?: Order;

  @Column('jsonb', { nullable: true })
  metadata: {
    width?: number;
    height?: number;
    dpi?: number;
    pageCount?: number;
    color?: string;
    tags?: string[];
    processingResults?: any;
  };

  @Column({ nullable: true })
  thumbnailPath?: string;

  @Column('jsonb', { nullable: true })
  versions: {
    type: string;
    path: string;
    size: number;
  }[];

  @Column({ default: false })
  isEncrypted: boolean;

  @Column({ nullable: true })
  encryptionKeyId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  deletedAt?: Date;

  @Column('jsonb', { nullable: true })
  processingHistory: {
    timestamp: Date;
    action: string;
    status: string;
    error?: string;
  }[];
}
