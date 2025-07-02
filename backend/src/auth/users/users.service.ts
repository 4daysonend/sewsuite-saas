import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOneOptions, QueryFailedError } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { UpdateUserDto } from '../../users/dto/update-user.dto';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { UsersModule } from '../../users/users.module';
// Use the UserCreatedEvent defined below instead of importing
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { plainToInstance } from 'class-transformer';

@Module({
  imports: [EventEmitterModule.forRoot(), UsersModule],
})
export class AppModule {}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findOne(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.usersRepository.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(
          `User with ID ${this.maskSensitiveData(id)} not found`,
        );
      }
      return plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Error finding user with ID ${this.maskSensitiveData(id)}`,
      );
    }
  }

  async findByEmail(
    email: string,
    includePassword = false,
  ): Promise<User | undefined> {
    try {
      this.logger.debug(`Finding user by email: ${this.maskEmail(email)}`);

      const queryOptions: FindOneOptions<User> = {
        where: { email },
      };

      if (includePassword) {
        queryOptions.select = [
          'id',
          'email',
          'password',
          'firstName',
          'lastName',
          'role',
          'createdAt',
          'lastLoginAt',
          'isActive',
        ];
      }

      const user = await this.usersRepository.findOne(queryOptions);

      // Convert `null` to `undefined` to match the expected return type
      return user || undefined;
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Error retrieving user with email ${this.maskEmail(email)}`,
      );
    }
  }

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    try {
      // Check if user already exists
      const existingUser = await this.findByEmail(createUserDto.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Hash password if it exists
      let hashedPassword: string | undefined;
      if (createUserDto.password) {
        const saltRounds = 12; // Industry standard
        hashedPassword = await bcrypt.hash(createUserDto.password, saltRounds);
      }

      // Create new user
      const newUser = this.usersRepository.create({
        id: uuidv4(),
        email: createUserDto.email,
        password: hashedPassword,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        role: createUserDto.role || 'user',
        isActive: true,
        createdAt: new Date(),
        emailVerified: false,
      });

      // Save user to database
      const savedUser = await this.usersRepository.save(newUser);

      // Emit event for other services
      this.eventEmitter.emit('user.created', new UserCreatedEvent(savedUser));

      // Transform to DTO without exposing sensitive data
      return plainToInstance(UserResponseDto, savedUser, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Error creating new user');
    }
  }

  async findAll(): Promise<UserResponseDto[]> {
    try {
      const users = await this.usersRepository.find();
      return plainToInstance(UserResponseDto, users, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      this.handleDatabaseError(error, 'Error finding all users');
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    try {
      // Update the lastLoginAt field to the current date/time
      await this.usersRepository.update(userId, {
        lastLoginAt: new Date(),
      });

      this.logger.debug(
        `Updated last login timestamp for user ${this.maskSensitiveData(userId)}`,
      );
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Error updating last login timestamp for user ${this.maskSensitiveData(userId)}`,
      );
    }
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.findOne(id);
      if (!user) {
        throw new NotFoundException(
          `User with ID ${this.maskSensitiveData(id)} not found`,
        );
      }

      // Hash password if provided
      if (updateUserDto.password) {
        const saltRounds = 12;
        updateUserDto.password = await bcrypt.hash(
          updateUserDto.password,
          saltRounds,
        );
      }

      // Update user
      await this.usersRepository.update(id, {
        ...updateUserDto,
        updatedAt: new Date(),
      });

      // Get updated user
      const updatedUser = await this.usersRepository.findOne({ where: { id } });
      return plainToInstance(UserResponseDto, updatedUser, {
        excludeExtraneousValues: true,
      });
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Error updating user with ID ${this.maskSensitiveData(id)}`,
      );
    }
  }

  async deactivate(id: string): Promise<void> {
    try {
      // Soft delete approach - don't actually delete the user
      await this.usersRepository.update(id, { isActive: false });
      this.logger.log(
        `User ${this.maskSensitiveData(id)} has been deactivated`,
      );
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Error deactivating user with ID ${this.maskSensitiveData(id)}`,
      );
    }
  }

  async validateUserCredentials(
    email: string,
    password: string,
  ): Promise<User> {
    // Find the user by email, including the password field
    const user = await this.findByEmail(email, true);

    // If no user is found with this email, throw UnauthorizedException
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    // If password doesn't match, throw UnauthorizedException
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Return the user if both email and password are valid
    return user;
  }

  async remove(id: string): Promise<void> {
    try {
      const user = await this.findOne(id);
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.usersRepository.delete(id);
      this.logger.log(
        `User with ID ${this.maskSensitiveData(id)} has been deleted`,
      );
    } catch (error) {
      this.handleDatabaseError(
        error,
        `Failed to delete user with ID ${this.maskSensitiveData(id)}`,
      );
    }
  }

  // Security utility methods
  private maskSensitiveData(data: string): string {
    if (!data) return 'undefined';
    if (data.length <= 8) return '*'.repeat(data.length);
    return `${data.substring(0, 3)}${'*'.repeat(data.length - 6)}${data.substring(data.length - 3)}`;
  }

  private maskEmail(email: string): string {
    if (!email) return 'undefined';
    const [localPart, domain] = email.split('@');
    if (!domain) return this.maskSensitiveData(email);

    const maskedLocalPart =
      localPart.length <= 3
        ? '*'.repeat(localPart.length)
        : `${localPart.substring(0, 2)}${'*'.repeat(localPart.length - 2)}`;

    return `${maskedLocalPart}@${domain}`;
  }

  private handleDatabaseError(error: any, message: string): never {
    this.logger.error(`${message}: ${error.message}`, error.stack);

    // Handle specific DB errors with appropriate HTTP exceptions
    if (error instanceof QueryFailedError) {
      // Handle constraint violations, etc.
      if (error.message.includes('duplicate key')) {
        throw new ConflictException('Entity already exists');
      }

      if (error.message.includes('foreign key constraint')) {
        throw new ConflictException('Referenced entity does not exist');
      }
    }

    // Re-throw NotFoundExceptions
    if (error instanceof NotFoundException) {
      throw error;
    }

    // For security, don't expose internal errors
    throw new InternalServerErrorException('Database operation failed');
  }
}

export class UserCreatedEvent {
  constructor(public readonly user: User) {}
}
