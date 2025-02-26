// sewsuite-saas/backend/test/users/user-profile.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserProfileService } from '../../src/users/services/user-profile.service';
import { User, UserRole } from '../../src/users/entities/user.entity';
import { StorageQuota } from '../../src/upload/entities/storage-quota.entity';
import { NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from '../../src/users/dto/update-user.dto';

describe('UserProfileService', () => {
  let service: UserProfileService;
  let userRepository: jest.Mocked<Repository<User>>;
  let quotaRepository: jest.Mocked<Repository<StorageQuota>>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.CLIENT,
    isActive: true,
    preferences: {
      theme: 'light',
      notifications: {
        email: true,
        sms: false,
      },
    },
    hasCompletedProfile: jest.fn().mockReturnValue(true),
  };

  const mockQuota = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    user: mockUser,
    totalSpace: 1073741824, // 1GB
    usedSpace: 104857600, // 100MB
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StorageQuota),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
    userRepository = module.get(getRepositoryToken(User));
    quotaRepository = module.get(getRepositoryToken(StorageQuota));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const wasProfileComplete = false;
      const updateDto: UpdateUserDto = { firstName: 'Updated', lastName: 'Name' };
      const updatedUser = { ...mockUser, ...updateDto };

      // Mock profile completion change
      mockUser.hasCompletedProfile.mockReturnValueOnce(wasProfileComplete);
      userRepository.findOne.mockResolvedValue(mockUser as any);
      userRepository.save.mockResolvedValue(updatedUser as any);

      const result = await service.updateProfile(mockUser.id, updateDto);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(mockUser.hasCompletedProfile).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('non-existent-id', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePreferences', () => {
    it('should update user preferences', async () => {
      const preferences = {
        theme: 'dark',
        notifications: { email: false },
      };

      const updatedUser = {
        ...mockUser,
        preferences: {
          ...mockUser.preferences,
          ...preferences,
        },
      };

      userRepository.findOne.mockResolvedValue(mockUser as any);
      userRepository.save.mockResolvedValue(updatedUser as any);

      const result = await service.updatePreferences(mockUser.id, preferences);

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(userRepository.save).toHaveBeenCalled();
      expect(result.preferences).toEqual(updatedUser.preferences);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updatePreferences('non-existent-id', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStorageQuota', () => {
    it('should return user storage quota', async () => {
      quotaRepository.findOne.mockResolvedValue(mockQuota as any);

      const result = await service.getStorageQuota(mockUser.id);

      expect(quotaRepository.findOne).toHaveBeenCalledWith({
        where: { user: { id: mockUser.id } },
      });
      expect(result).toEqual(mockQuota);
    });

    it('should throw NotFoundException when quota not found', async () => {
      quotaRepository.findOne.mockResolvedValue(null);

      await expect(service.getStorageQuota(mockUser.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});