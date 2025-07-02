import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { Product } from '../entities/product.entity';
import { ProductImage } from '../entities/product-image.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { Pagination } from '../../common/interfaces/pagination.interface';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductImage)
    private readonly productImageRepository: Repository<ProductImage>,
    @InjectRepository(ProductVariant)
    private readonly productVariantRepository: Repository<ProductVariant>,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    userId: string,
  ): Promise<Product> {
    const product = this.productRepository.create({
      ...createProductDto,
      tailorId: userId,
    });

    // Save the product first to get an ID
    const savedProduct = await this.productRepository.save(product);

    // Handle images if provided
    if (createProductDto.images && createProductDto.images.length > 0) {
      const images = createProductDto.images.map((imageDto, index) =>
        this.productImageRepository.create({
          ...imageDto,
          productId: savedProduct.id,
          isMain: index === 0, // First image is main by default
        }),
      );
      await this.productImageRepository.save(images);
    }

    // Handle variants if provided
    if (createProductDto.variants && createProductDto.variants.length > 0) {
      const variants = createProductDto.variants.map((variantDto) =>
        this.productVariantRepository.create({
          ...variantDto,
          productId: savedProduct.id,
        }),
      );
      await this.productVariantRepository.save(variants);
    }

    // Load the complete product with relations
    return this.findOne(savedProduct.id);
  }

  async findAll(options: {
    page: number;
    limit: number;
    search?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    tailorId?: string;
    isActive?: boolean;
  }): Promise<Pagination<Product>> {
    const {
      page,
      limit,
      search,
      category,
      minPrice,
      maxPrice,
      tailorId,
      isActive,
    } = options;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.variants', 'variants')
      .leftJoinAndSelect('product.categories', 'categories')
      .leftJoinAndSelect('product.tailor', 'tailor');

    // Apply filters
    if (search) {
      queryBuilder.andWhere(
        'product.name LIKE :search OR product.description LIKE :search',
        {
          search: `%${search}%`,
        },
      );
    }

    if (category) {
      queryBuilder.andWhere('categories.id = :categoryId', {
        categoryId: category,
      });
    }

    if (minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    if (tailorId) {
      queryBuilder.andWhere('product.tailorId = :tailorId', { tailorId });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('product.isActive = :isActive', { isActive });
    }

    // Order by creation date, newest first
    queryBuilder.orderBy('product.createdAt', 'DESC');

    return paginate<Product>(queryBuilder, { page, limit });
  }

  async findOne(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: ['images', 'variants', 'categories', 'tailor'],
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    userId: string,
    userRole: string,
  ): Promise<Product> {
    const product = await this.findOne(id);

    // Check permissions
    if (userRole !== 'admin' && product.tailorId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this product',
      );
    }

    // Update basic product info
    this.productRepository.merge(product, updateProductDto);
    await this.productRepository.save(product);

    // Handle images if provided
    if (updateProductDto.images) {
      // Delete existing images
      await this.productImageRepository.delete({ productId: id });

      // Add new images
      if (updateProductDto.images.length > 0) {
        const images = updateProductDto.images.map((imageDto, index) =>
          this.productImageRepository.create({
            ...imageDto,
            productId: id,
            isMain: index === 0, // First image is main by default
          }),
        );
        await this.productImageRepository.save(images);
      }
    }

    // Handle variants if provided
    if (updateProductDto.variants) {
      // Delete existing variants
      await this.productVariantRepository.delete({ productId: id });

      // Add new variants
      if (updateProductDto.variants.length > 0) {
        const variants = updateProductDto.variants.map((variantDto) =>
          this.productVariantRepository.create({
            ...variantDto,
            productId: id,
          }),
        );
        await this.productVariantRepository.save(variants);
      }
    }

    // Load the updated product with relations
    return this.findOne(id);
  }

  async remove(id: string, userId: string, userRole: string): Promise<void> {
    const product = await this.findOne(id);

    // Check permissions
    if (userRole !== 'admin' && product.tailorId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this product',
      );
    }

    await this.productRepository.remove(product);
  }
}
