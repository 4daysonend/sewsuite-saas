import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ProductImage } from './product-image.entity';
import { ProductVariant } from './product-variant.entity';
import { Category } from './category.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  stock: number;

  @Column({ nullable: true })
  sku: string;

  @Column({ nullable: true })
  @Index()
  tailorId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'tailorId' })
  tailor: User;

  @Column('jsonb', { default: {} })
  specifications: Record<string, any>;

  @Column('simple-array', { nullable: true })
  sizes: string[];

  @Column('simple-array', { nullable: true })
  colors: string[];

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ nullable: true })
  mainImageUrl: string;

  @OneToMany(() => ProductImage, (image: ProductImage) => image.product, {
    cascade: true,
    eager: true,
  })
  images: ProductImage[];

  @OneToMany(
    () => ProductVariant,
    (variant: ProductVariant) => variant.product,
    {
      cascade: true,
      eager: true,
    },
  )
  variants: ProductVariant[];

  @ManyToMany(() => Category)
  @JoinTable({
    name: 'product_categories',
    joinColumn: { name: 'productId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'categoryId', referencedColumnName: 'id' },
  })
  categories: Category[];

  @Column({ default: 0 })
  ordersCount: number;

  @Column({ default: 0 })
  viewsCount: number;

  @Column({ default: 0 })
  ratingsCount: number;

  @Column('decimal', { precision: 3, scale: 1, default: 0 })
  averageRating: number;

  @Column({ nullable: true })
  customizationOptions: string;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.product)
  orderItems: OrderItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Calculate if product is in stock
  get inStock(): boolean {
    return this.stock > 0;
  }

  // Calculate if product is custom made
  get isCustomMade(): boolean {
    return !!this.customizationOptions;
  }
}
