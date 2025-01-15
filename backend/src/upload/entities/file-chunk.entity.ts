@Entity('file_chunks')
export class FileChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fileId: string;

  @Column()
  chunkNumber: number;

  @Column()
  size: number;

  @Column()
  path: string;

  @Column({ default: false })
  processed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
