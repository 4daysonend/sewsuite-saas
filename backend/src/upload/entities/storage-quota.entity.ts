@Entity('storage_quotas')
export class StorageQuota {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn()
  user: User;

  @Column('bigint')
  totalSpace: number;

  @Column('bigint')
  usedSpace: number;

  @Column({ type: 'jsonb', nullable: true })
  quotaByCategory: Record<FileCategory, number>;

  @Column({ type: 'timestamptz', nullable: true })
  lastQuotaUpdate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}