import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm'; // Remove FindOptionsWhere if you're not using it explicitly
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { StorageQuota } from '../upload/entities/storage-quota.entity';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdatePasswordDto,
  UpdateEmailDto,
  UserPreferencesDto,
  QueryUsersDto,
} from './dto';
import { UserRole } from './enums/user-role.enum';
import { DEFAULT_PREFERENCES } from './constants/user-defaults';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(StorageQuota)
    private readonly quotaRepository: Repository<StorageQuota>,
  ) {}

  /**
   * Create a new user
   * @param createUserDto User creation data
   * @returns Created user
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if email exists before proceeding
    if (!createUserDto.email) {
      throw new BadRequestException('Email is required');
    }

    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Add password validation
    if (!createUserDto.password) {
      throw new BadRequestException('Password is required');
    }

    const hashedPassword = await this.hashPassword(createUserDto.password);

    // Fix the create method to use proper types
    const user = this.usersRepository.create({
      ...createUserDto,
      password: hashedPassword,
      // Ensure preferences field exists and use DEFAULT_PREFERENCES as fallback
      preferences: createUserDto.preferences || DEFAULT_PREFERENCES,
      // If role is a string, convert it to UserRole enum
      ...(createUserDto.role && { role: createUserDto.role as UserRole }),
    });

    // Save the user and ensure it returns a single User, not an array
    const savedUser = await this.usersRepository.save(user);

    // Create default storage quota for user
    await this.initializeStorageQuota(savedUser);

    return savedUser;
  }

  /**
   * Find users based on query parameters
   * @param queryDto Query parameters
   * @returns Paginated users
   */
  async findAll(
    queryDto: QueryUsersDto,
  ): Promise<{ users: User[]; total: number }> {
    const {
      role,
      isActive,
      isVerified,
      page = 1,
      limit = 20,
      searchTerm,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = queryDto;

    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    // Apply filters
    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (typeof isActive === 'boolean') {
      queryBuilder.andWhere('user.isActive = :isActive', { isActive });
    }

    if (typeof isVerified === 'boolean') {
      queryBuilder.andWhere('user.emailVerified = :isVerified', { isVerified });
    }

    // Apply search
    if (searchTerm) {
      queryBuilder.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${searchTerm}%` },
      );
    }

    // Apply sorting
    queryBuilder.orderBy(`user.${sortBy}`, sortOrder);

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [users, total] = await queryBuilder.getManyAndCount();

    return { users, total };
  }

  /**
   * Find user by ID
   * @param id User ID
   * @returns User entity
   */
  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['subscriptions', 'clientOrders', 'tailorOrders'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  /**
   * Find user by email
   * @param email User email
   * @returns User entity or null
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  /**
   * Find user by Google ID
   * @param googleId Google ID
   * @returns User entity or null
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  /**
   * Find user by Stripe customer ID
   * @param stripeCustomerId Stripe customer ID
   * @returns User entity or null
   */
  async findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { stripeCustomerId } });
  }

  /**
   * Update user information
   * @param id User ID
   * @param updateUserDto Update data
   * @returns Updated user
   */
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);

    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingUser = await this.findByEmail(updateUserDto.email);
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }
      user.emailVerified = false;
    }

    if (updateUserDto.password) {
      updateUserDto.password = await this.hashPassword(updateUserDto.password);
    }

    // Handle profile completion status change
    const wasProfileComplete = user.hasCompletedProfile();
    Object.assign(user, updateUserDto);
    const isProfileComplete = user.hasCompletedProfile();

    if (!wasProfileComplete && isProfileComplete) {
      // Handle first-time profile completion
      await this.handleProfileCompletion(user);
    }

    return this.usersRepository.save(user);
  }

  /**
   * Update user password
   * @param id User ID
   * @param updatePasswordDto Password update data
   */
  async updatePassword(
    id: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<void> {
    const user = await this.findOne(id);

    const isPasswordValid = await this.verifyPassword(
      updatePasswordDto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.password = await this.hashPassword(updatePasswordDto.newPassword);
    await this.usersRepository.save(user);
  }

  /**
   * Update user email
   * @param id User ID
   * @param updateEmailDto Email update data
   * @returns Updated user
   */
  async updateEmail(id: string, updateEmailDto: UpdateEmailDto): Promise<User> {
    const user = await this.findOne(id);

    // Add validation for currentPassword and newEmail
    if (!updateEmailDto.currentPassword) {
      throw new BadRequestException('Current password is required');
    }

    if (!updateEmailDto.newEmail) {
      throw new BadRequestException('New email is required');
    }

    const isPasswordValid = await this.verifyPassword(
      updateEmailDto.currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      throw new BadRequestException('Password is incorrect');
    }

    const existingUser = await this.findByEmail(updateEmailDto.newEmail);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    user.email = updateEmailDto.newEmail;
    user.emailVerified = false;

    // Generate new verification token
    user.emailVerificationToken = this.generateVerificationToken();

    const savedUser = await this.usersRepository.save(user);

    // Send verification email
    await this.sendVerificationEmail(savedUser);

    return savedUser;
  }

  /**
   * Update user preferences
   * @param id User ID
   * @param preferences Updated preferences
   * @returns Updated user
   */
  async updatePreferences(
    id: string,
    preferences: Partial<UserPreferencesDto>,
  ): Promise<User> {
    const user = await this.findOne(id);

    user.preferences = {
      ...user.preferences,
      ...preferences,
    };

    return this.usersRepository.save(user);
  }

  /**
   * Soft delete user
   * @param id User ID
   */
  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.usersRepository.save(user);
  }

  /**
   * Mark user email as verified
   * @param token Verification token
   * @returns Updated user
   */
  async verifyEmail(token: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;

    return this.usersRepository.save(user);
  }

  /**
   * Initialize password reset process
   * @param email User email
   */
  async initiatePasswordReset(email: string): Promise<void> {
    const user = await this.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    user.passwordResetToken = this.generateResetToken();
    user.passwordResetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.usersRepository.save(user);
    await this.sendPasswordResetEmail(user);
  }

  /**
   * Reset user password with token
   * @param token Reset token
   * @param newPassword New password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { passwordResetToken: token },
    });

    if (!user || !user.isPasswordResetTokenValid()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.password = await this.hashPassword(newPassword);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined; // Changed from null to undefined

    await this.usersRepository.save(user);
  }

  /**
   * Update user role
   * @param id User ID
   * @param role New role
   * @returns Updated user
   */
  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findOne(id);

    user.role = role;

    if (role === UserRole.TAILOR && !user.stripeConnectAccountId) {
      // Handle Stripe Connect account creation for new tailors
      await this.setupTailorStripeAccount(user);
    }

    return this.usersRepository.save(user);
  }

  /**
   * Record user login
   * @param id User ID
   * @returns Updated user
   */
  async recordLogin(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.lastLoginAt = new Date();
    return this.usersRepository.save(user);
  }

  /**
   * Update last login time for user
   * @param userId User ID
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      lastLoginAt: new Date(),
    });
  }

  /**
   * Initialize storage quota for new user
   * @param user User entity
   */
  private async initializeStorageQuota(user: User): Promise<void> {
    const defaultQuota = 1073741824; // 1GB in bytes

    await this.quotaRepository.save({
      user,
      totalSpace: defaultQuota,
      usedSpace: 0,
      quotaByCategory: {},
    });
  }

  /**
   * Handle first-time profile completion
   * @param user User entity
   */
  private async handleProfileCompletion(user: User): Promise<void> {
    // Add any onboarding or reward logic here
    this.logger.log(`User ${user.id} completed profile for first time`);
  }

  /**
   * Hash password string
   * @param password Plain password
   * @returns Hashed password
   */
  private async hashPassword(password: string | undefined): Promise<string> {
    if (!password) {
      throw new BadRequestException('Password is required');
    }
    return bcrypt.hash(password, 10);
  }

  /**
   * Verify password against hash
   * @param password Plain password
   * @param hash Password hash
   * @returns Whether password matches
   */
  private async verifyPassword(
    password: string,
    hash: string | undefined,
  ): Promise<boolean> {
    if (!hash) {
      return false;
    }
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate email verification token
   * @returns Random token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate password reset token
   * @returns Random token
   */
  private generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Send verification email to user
   * @param user User entity
   */
  private async sendVerificationEmail(user: User): Promise<void> {
    // Implement email sending logic
    this.logger.debug(`Sending verification email to ${user.email}`);
  }

  /**
   * Send password reset email to user
   * @param user User entity
   */
  private async sendPasswordResetEmail(user: User): Promise<void> {
    // Implement email sending logic
    this.logger.debug(`Sending password reset email to ${user.email}`);
  }

  /**
   * Setup Stripe Connect account for tailor
   * @param user User entity
   */
  private async setupTailorStripeAccount(user: User): Promise<void> {
    // Implement Stripe Connect account creation
    this.logger.debug(
      `Setting up Stripe Connect account for tailor ${user.id}`,
    );
  }
}
