import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../common/base.entity';

/**
 * Entity for managing file chunks during multipart uploads
 */
@Entity('file_chunks')
@Index(['fileId', 'chunkNumber'], { unique: true })
export class FileChunk extends BaseEntity {
  /**
   * ID of the file this chunk belongs to
   */
  @Column()
  @Index()
  fileId = '';

  /**
   * Chunk sequence number (0-based)
   */
  @Column()
  chunkNumber = 0;

  /**
   * Size of chunk in bytes
   */
  @Column()
  size = 0;

  /**
   * Storage path to chunk file
   */
  @Column()
  path = '';

  /**
   * Whether chunk has been processed
   */
  @Column({ default: false })
  processed = false;

  /**
   * ETag from storage provider (for verification)
   */
  @Column({ nullable: true })
  etag?: string;

  /**
   * Timestamp when chunk was processed
   */
  @Column({ type: 'timestamptz', nullable: true })
  processedAt?: Date;

  /**
   * Timestamp when upload timeout expires
   * (for cleanup of abandoned uploads)
   */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  constructor(partial: Partial<FileChunk>) {
    super();
    Object.assign(this, partial);
  }
}