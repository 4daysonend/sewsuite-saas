import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users.service';
import { User, UserRole } from '../entities/user.entity';
import { StorageQuota } from '../../upload/entities/storage-quota.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ConflictException, NotFoundException } from '@nestjs/common';

// Mock bcrypt for password hashing
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let quotaRepository: jest.Mocked<Repository<StorageQuota>>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    password: 'hashed_password',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.CLIENT,
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    hasCompletedProfile: jest.fn().mockReturnValue(true),
  };

  const mockUserDto: CreateUserDto = {
    email: 'new@example.com',
    password: 'password123',
    firstName: 'Jane',
    lastName: 'Smith',
    role: UserRole.CLIENT,
  };

  const mockUpdateDto: UpdateUserDto = {
    firstName: 'Updated',
    lastName: 'Name',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StorageQuota),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
    quotaRepository = module.get(getRepositoryToken(StorageQuota));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser as any);
      userRepository.save.mockResolvedValue(mockUser as any);
      quotaRepository.save.mockResolvedValue({} as any);

      const result = await service.create(mockUserDto);

      expect(userRepository.findOne).toHaveBeenCalled();
      expect(bcrypt.hash).toHaveBeenCalledWith(mockUserDto.password, 10);
      expect(userRepository.create).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
      expect(quotaRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictException when email already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);

      await expect(service.create(mockUserDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('findOne', () => {
    it('should retrieve a user by id', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.findOne(mockUser.id);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: ['subscriptions', 'clientOrders', 'tailorOrders'],
      });
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('should retrieve a user by email', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.findByEmail(mockUser.email);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: mockUser.email.toLowerCase() },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found by email', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('non-existent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updatedUser = { ...mockUser, ...mockUpdateDto };
      userRepository.findOne.mockResolvedValue(mockUser as any);
      userRepository.save.mockResolvedValue(updatedUser as any);

      const result = await service.update(mockUser.id, mockUpdateDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: ['subscriptions', 'clientOrders', 'tailorOrders'],
      });
      expect(userRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', mockUpdateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should check for email conflicts when email is updated', async () => {
      userRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // First call for finding user by ID
        .mockResolvedValueOnce({ id: 'another-user' } as any); // Second call for finding user by email

      await expect(
        service.update(mockUser.id, { email: 'existing@example.com' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updatePassword', () => {
    it('should update a user password', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);
      userRepository.save.mockResolvedValue(mockUser as any);

      await service.updatePassword(mockUser.id, {
        currentPassword: 'current123',
        newPassword: 'new123',
      });

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'current123',
        mockUser.password,
      );
      expect(bcrypt.hash).toHaveBeenCalledWith('new123', 10);
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw error when current password is incorrect', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.updatePassword(mockUser.id, {
          currentPassword: 'wrong',
          newPassword: 'new123',
        }),
      ).rejects.toThrow();
    });
  });

  describe('remove', () => {
    it('should soft delete a user', async () => {
      userRepository.findOne.mockResolvedValue(mockUser as any);
      userRepository.save.mockResolvedValue({
        ...mockUser,
        isActive: false,
      } as any);

      await service.remove(mockUser.id);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        relations: ['subscriptions', 'clientOrders', 'tailorOrders'],
      });
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
    });
  });
});
