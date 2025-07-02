import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from '../users.service';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { QueryUsersDto } from '../dto/query-users.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '../entities/user.entity';

// Mock bcrypt
jest.mock('bcryptjs');

type MockRepository<_T = any> = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  findAll?: jest.Mock;
  // Add other repository methods you use
};

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: MockRepository<User>;

  const mockUser: User = {
    id: '123',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.USER,
    profilePicture: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: {},
    isActive: true,
    emailVerified: false,
    subscriptions: [],
    lastLoginAt: undefined,
    refreshTokens: [],
    phoneNumber: undefined,
    locale: undefined,
    stripeCustomerId: undefined,
    hasCompletedProfile: jest.fn().mockReturnValue(true),
    displayRole: '',
    canAccessTailorFeatures: function (): boolean {
      throw new Error('Function not implemented.');
    },
    hasStripeSetup: function (): boolean {
      throw new Error('Function not implemented.');
    },
    isPasswordResetTokenValid: function (): boolean {
      throw new Error('Function not implemented.');
    },
    emailToLowerCase: function (): void {
      throw new Error('Function not implemented.');
    },
    fullName: '',
    toJSON: function (): Omit<
      User,
      | 'password'
      | 'hasCompletedProfile'
      | 'remove'
      | 'emailVerificationToken'
      | 'passwordResetToken'
      | 'passwordResetExpires'
      | 'displayRole'
      | 'canAccessTailorFeatures'
      | 'hasStripeSetup'
      | 'isPasswordResetTokenValid'
      | 'emailToLowerCase'
      | 'fullName'
      | 'toJSON'
      | 'hasId'
      | 'save'
      | 'softRemove'
      | 'recover'
      | 'reload'
    > {
      throw new Error('Function not implemented.');
    },
    hasId: function (): boolean {
      throw new Error('Function not implemented.');
    },
    save: function (): Promise<User> {
      throw new Error('Function not implemented.');
    },
    remove: function (): Promise<User> {
      throw new Error('Function not implemented.');
    },
    softRemove: function (): Promise<User> {
      throw new Error('Function not implemented.');
    },
    recover: function (): Promise<User> {
      throw new Error('Function not implemented.');
    },
    reload: function (): Promise<void> {
      throw new Error('Function not implemented.');
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a user', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      };

      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.create.mockReturnValue(mockUser);
      usersRepository.save.mockResolvedValue(mockUser);

      // Act
      const result = await service.create(createUserDto);

      // Assert
      expect(result).toEqual(mockUser);
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: createUserDto.email,
        }),
      );
      expect(usersRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      // Arrange
      const createUserDto: CreateUserDto = {
        email: 'existing@example.com',
        password: 'password123',
      };

      usersRepository.findOne.mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      // Arrange
      const mockUsers = [mockUser];
      usersRepository.find.mockResolvedValue(mockUsers);

      // Act
      const result = await service.findAll();

      // Assert
      expect(result).toEqual(mockUsers);
      expect(usersRepository.find).toHaveBeenCalled();
    });

    it('should return users and total count', async () => {
      // Arrange
      const queryDto: QueryUsersDto = {
        page: 1,
        limit: 10,
      };

      // Mock implementation that checks for parameters
      usersRepository.findAll = jest.fn().mockImplementation((dto) => {
        // You can add validation here if needed
        return Promise.resolve({ users: [mockUser], total: 1 });
      });

      // Act
      const result = await service.findAll(queryDto);

      // Assert
      expect(result).toEqual({ users: [mockUser], total: 1 });
      expect(usersRepository.findAll).toHaveBeenCalledWith(queryDto);
    });
  });

  describe('findOne', () => {
    it('should return a user if it exists', async () => {
      // Arrange
      usersRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.findOne('123');

      // Assert
      expect(result).toEqual(mockUser);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      usersRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByEmail', () => {
    it('should return a user if email exists', async () => {
      // Arrange
      usersRepository.findOne.mockResolvedValue(mockUser);

      // Act
      const result = await service.findByEmail('test@example.com');

      // Assert
      expect(result).toEqual(mockUser);
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null if email does not exist', async () => {
      // Arrange
      usersRepository.findOne.mockResolvedValue(null);

      // Act
      const result = await service.findByEmail('nonexistent@example.com');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update and return the user', async () => {
      // Arrange
      const updateUserDto: UpdateUserDto = {
        firstName: 'Updated',
      };

      const updatedUser = { ...mockUser, firstName: 'Updated' };
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.save.mockResolvedValue(updatedUser);

      // Act
      const result = await service.update('123', updateUserDto);

      // Assert
      expect(result).toEqual(updatedUser);
      expect(usersRepository.findOne).toHaveBeenCalled();
      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          firstName: 'Updated',
        }),
      );
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      usersRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.update('999', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update the lastLoginAt timestamp', async () => {
      // Arrange
      const now = new Date();
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);
      usersRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      await service.updateLastLogin('123');

      // Assert
      expect(usersRepository.update).toHaveBeenCalledWith('123', {
        lastLoginAt: now,
      });
    });
  });

  describe('remove', () => {
    it('should remove a user if it exists', async () => {
      // Arrange
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.delete.mockResolvedValue({ affected: 1 });

      // Act
      const result = await service.remove('123');

      // Assert
      expect(result).toBeUndefined();
      expect(usersRepository.findOne).toHaveBeenCalled();
      expect(usersRepository.delete).toHaveBeenCalledWith('123');
    });

    it('should throw NotFoundException if user does not exist', async () => {
      // Arrange
      usersRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove('999')).rejects.toThrow(NotFoundException);
    });
  });
});
