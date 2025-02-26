import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad
} from 'typeorm';
import { Exclude, Expose } from 'class-transformer';
import { BaseEntity } from '../../common/base.entity';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';

/**
 * File categories
 */
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

/**
 * File processing status
 */
export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  FAILED = 'failed',
}

/**
 * File metadata interface
 */
export interface FileMetadata {
  description?: string;
  tags?: string[];
  width?: number;
  height?: number;
  dpi?: number;
  format?: string;
  space?: string;
  channels?: number;
  depth?: number;
  density?: number;
  hasAlpha?: boolean;
  isProgressive?: boolean;
  pageCount?: number;
  pdfInfo?: Record<string, any>;
  pdfMetadata?: Record<string, any>;
  pdfVersion?: string;
  textContent?: string;
  error?: string;
  errorTimestamp?: string;
  hash?: string;
  thumbnails?: Array<{
    size: number;
    path: string;
    width: number;
    height: number;
  }>;
  uploadStarted?: string;
  processStarted?: string;
  processCompleted?: string;
  thumbnailGenerated?: boolean;
  thumbnailGeneratedAt?: string;
  thumbnailQueued?: boolean;
  thumbnailQueuedAt?: string;
  thumbnailError?: string;
  thumbnailErrorTime?: string;
  optimizedGenerated?: boolean;
  downloads?: number;
  lastDownloadedAt?: string;
  lastDownloadedBy?: string;
  chunksReceived?: number;
  totalChunks?: number;
  lastChunkReceived?: string;
  combinedAt?: string;
  originalChunks?: number;
  [key: string]: any;
}

/**
 * File version interface
 */
interface FileVersion {
  type: string;
  path: string;
  size: number;
}

/**
 * File entity
 */
@Entity('files')
@Index(['uploader.id'])
@Index(['order.id'])
@Index(['category'])
@Index(['status'])
export class File extends BaseEntity {
  /**
   * Original filename
   */
  @Column()
  originalName = '';

  /**
   * MIME type
   */
  @Column()
  mimeType = '';

  /**
   * File size in bytes
   */
  @Column()
  size = 0;

  /**
   * Storage path
   */
  @Column()
  path = '';

  /**
   * Public URL (if available)
   */
  @Column({ nullable: true })
  publicUrl?: string;

  /**
   * File category
   */
  @Column({
    type: 'enum',
    enum: FileCategory,
    default: FileCategory.REFERENCE,
  })
  category: FileCategory = FileCategory.REFERENCE;

  /**
   * Processing status
   */
  @Column({
    type: 'enum',
    enum: FileStatus,
    default: FileStatus.PENDING,
  })
  status: FileStatus = FileStatus.PENDING;

  /**
   * User who uploaded the file
   */
  @ManyToOne(() => User, { nullable: false })
  @JoinColumn()
  uploader!: User;

  /**
   * Related order (if any)
   */
  @ManyToOne(() => Order, (order) => order.attachments, { nullable: true })
  order?: Order;

  /**
   * File metadata
   */
  @Column('jsonb', { nullable: true })
  metadata: FileMetadata = {};

  /**
   * Path to file thumbnail
   */
  @Column({ nullable: true })
  thumbnailPath?: string;

  /**
   * Available file versions
   */
  @Column('jsonb', { nullable: true })
  versions: FileVersion[] = [];

  /**
   * Whether file is encrypted
   */
  @Column({ default: false })
  isEncrypted = false;

  /**
   * Encryption key ID
   */
  @Column({ nullable: true })
  @Exclude()
  encryptionKeyId?: string;

  /**
   * Processing history
   */
  @Column('jsonb', { nullable: true })
  processingHistory: Array<{
    timestamp: Date;
    action: string;
    status: string;
    error?: string;
  }> = [];

  // Virtual properties
  private tempIsImage?: boolean;
  private tempIsPdf?: boolean;
  private tempFileExtension?: string;

  constructor(partial: Partial<File>) {
    super();
    Object.assign(this, partial);
  }

  @BeforeInsert()
  @BeforeUpdate()
  sanitizeMetadata() {
    // Ensure metadata is an object
    if (!this.metadata || typeof this.metadata !== 'object') {
      this.metadata = {};
    }
  }

  @AfterLoad()
  computeDerivedProperties() {
    this.tempIsImage = this.mimeType.startsWith('image/');
    this.tempIsPdf = this.mimeType === 'application/pdf';
    this.tempFileExtension = this.getFileExtension();
  }

  /**
   * Get file extension based on MIME type
   * @returns File extension
   */
  private getFileExtension(): string {
    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'application/json': 'json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    };

    return extensionMap[this.mimeType] || '';
  }

  /**
   * Whether the file is an image
   */
  @Expose()
  get isImage(): boolean {
    return this.tempIsImage ?? this.mimeType.startsWith('image/');
  }

  /**
   * Whether the file is a PDF
   */
  @Expose()
  get isPdf(): boolean {
    return this.tempIsPdf ?? this.mimeType === 'application/pdf';
  }

  /**
   * Get file extension
   */
  @Expose()
  get fileExtension(): string {
    return this.tempFileExtension ?? this.getFileExtension();
  }

  /**
   * Get display name
   */
  @Expose()
  get displayName(): string {
    if (this.metadata?.description) {
      return this.metadata.description;
    }
    return this.originalName;
  }

  /**
   * Add processing history event
   * @param action Action performed
   * @param status Status of action
   * @param error Optional error message
   */
  addHistoryEvent(action: string, status: string, error?: string): void {
    this.processingHistory = [
      ...(this.processingHistory || []),
      {
        timestamp: new Date(),
        action,
        status,
        ...(error ? { error } : {}),
      },
    ];
  }

  /**
   * Transform for JSON serialization
   * @returns Serialized object
   */
  toJSON() {
    const { encryptionKeyId, ...safeFile } = this;
    return safeFile;
  }
}