import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, TreeRepository } from 'typeorm';
import { paginate, Pagination } from 'nestjs-typeorm-paginate';
import { Category } from '../entities/category.entity';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category> &
      TreeRepository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const category = this.categoryRepository.create(createCategoryDto);

    // If parent ID is provided, set parent relationship
    if (createCategoryDto.parentId) {
      const parent = await this.categoryRepository.findOne({
        where: { id: createCategoryDto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent category with ID ${createCategoryDto.parentId} not found`,
        );
      }
      category.parent = parent;
    }

    return this.categoryRepository.save(category);
  }

  async findAll(options: {
    page: number;
    limit: number;
    parentId?: string;
  }): Promise<Pagination<Category>> {
    const { page, limit, parentId } = options;

    const queryBuilder = this.categoryRepository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.parent', 'parent');

    if (parentId === 'null' || parentId === undefined) {
      queryBuilder.where('category.parent IS NULL');
    } else if (parentId) {
      queryBuilder.where('category.parent.id = :parentId', { parentId });
    }

    queryBuilder.orderBy('category.sortOrder', 'ASC');

    return paginate<Category>(queryBuilder, { page, limit });
  }

  async getTree() {
    return this.categoryRepository.findTrees();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return category;
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.findOne(id);

    // Update category fields
    this.categoryRepository.merge(category, updateCategoryDto);

    // If parent ID is provided, update parent relationship
    if (updateCategoryDto.parentId !== undefined) {
      if (updateCategoryDto.parentId === null) {
        category.parent = null;
      } else {
        const parent = await this.categoryRepository.findOne({
          where: { id: updateCategoryDto.parentId },
        });
        if (!parent) {
          throw new NotFoundException(
            `Parent category with ID ${updateCategoryDto.parentId} not found`,
          );
        }
        category.parent = parent;
      }
    }

    // It looks like this was example code meant to show potential changes
    // Remove or comment it out, as the variable someProperty is not defined
    // and not actually needed for this function

    // Before (causing error):
    // someProperty = category.parent;

    // After (fixed):
    // if (category.parent) {
    //   const someProperty = category.parent;
    //   console.log('Parent category:', someProperty);
    // } else {
    //   // Handle the case where parent is undefined
    //   console.log('No parent category found');
    // }

    return this.categoryRepository.save(category);
  }

  async updateCategory(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } });

    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    // If parentId is provided, set the parent
    if (updateCategoryDto.parentId) {
      const parentCategory = await this.categoryRepository.findOne({
        where: { id: updateCategoryDto.parentId },
      });

      if (!parentCategory) {
        throw new BadRequestException(
          `Parent category with ID ${updateCategoryDto.parentId} not found`,
        );
      }

      category.parent = parentCategory;
    } else {
      // When no parent is specified, set to null
      category.parent = null;
    }

    // Update other properties
    if (updateCategoryDto.name) {
      category.name = updateCategoryDto.name;
    }

    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);

    // First, handle children by either deleting them or reassigning
    if (category.children && category.children.length > 0) {
      // Option 1: Delete children as well
      // await this.categoryRepository.remove(category.children);

      // Option 2: Move children to parent of current category
      for (const child of category.children) {
        child.parent = category.parent || null; // Use null if parent doesn't exist
        await this.categoryRepository.save(child);
      }
    }

    await this.categoryRepository.remove(category);
  }
}
