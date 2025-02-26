import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleManagementService } from '../services/role-management.service';
import { User, UserRole } from '../entities/user.entity';
import { StorageQuota } from '../../upload/entities/storage-quota.entity';
import { BadRequestException } from '@nestjs/common';

describe('RoleManagementService', () => {
  let service: RoleManagementService;
  let userRepository: jest.Mocked<Repository<User>>;
  let quotaRepository: jest.Mocked<Repository<StorageQuota>>;

  const mockClient = {
    id: 'client-123',
    email: 'client@example.com',
    firstName: 'Client',
    lastName: 'User',
    role: UserRole.CLIENT,
    isActive: true,
    emailVerified: true,
    subscriptions: [{ status: 'active', stripePriceId: 'price_basic' }],
    hasCompletedProfile: jest.fn().mockReturnValue(true),
  };

  const mockTailor = {
    id: 'tailor-123',
    email: 'tailor@example.com',
    firstName: 'Tailor',
    lastName: 'User',
    role: UserRole.TAILOR,
    isActive: true,
    emailVerified: true,
    subscriptions: [{ status: 'active', stripePriceId: 'price_business' }],
    hasCompletedProfile: jest.fn().mockReturnValue(true),
  };

  const mockQuota = {
    id: 'quota-123',
    user: { id: mockClient.id },
    totalSpace: 1073741824,
    usedSpace: 52428800,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleManagementService,
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

    service = module.get<RoleManagementService>(RoleManagementService);
    userRepository = module.get(getRepositoryToken(User));
    quotaRepository = module.get(getRepositoryToken(StorageQuota));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateUserRole', () => {
    it('should update user role from client to tailor', async () => {
      // Mock a client with business subscription
      const clientWithSub = {
        ...mockClient,
        subscriptions: [{ status: 'active', stripePriceId: 'price_business' }],
      };

      userRepository.findOne.mockResolvedValue(clientWithSub as any);
      userRepository.save.mockResolvedValue({
        ...clientWithSub,
        role: UserRole.TAILOR,
      } as any);
      quotaRepository.findOne.mockResolvedValue(mockQuota as any);
      quotaRepository.save.mockResolvedValue({
        ...mockQuota,
        totalSpace: 10737418240, // 10GB
      } as any);

      const result = await service.updateUserRole(
        clientWithSub.id,
        UserRole.TAILOR,
      );

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: clientWithSub.id },
        relations: ['subscriptions'],
      });
      expect(quotaRepository.findOne).toHaveBeenCalledWith({
        where: { user: { id: clientWithSub.id } },
      });
      expect(quotaRepository.save).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.TAILOR,
        }),
      );
      expect(result.role).toBe(UserRole.TAILOR);
    });

    it('should update user role from tailor to client', async () => {
      userRepository.findOne.mockResolvedValue(mockTailor as any);
      userRepository.save.mockResolvedValue({
        ...mockTailor,
        role: UserRole.CLIENT,
      } as any);
      quotaRepository.findOne.mockResolvedValue({
        ...mockQuota,
        totalSpace: 10737418240, // 10GB
      } as any);
      quotaRepository.save.mockResolvedValue({
        ...mockQuota,
        totalSpace: 1073741824, // 1GB
      } as any);

      const result = await service.updateUserRole(
        mockTailor.id,
        UserRole.CLIENT,
      );

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.CLIENT,
        }),
      );
      expect(quotaRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          totalSpace: 1073741824, // 1GB
        }),
      );
      expect(result.role).toBe(UserRole.CLIENT);
    });

    it('should throw BadRequestException when upgrading to tailor without verified email', async () => {
      const unverifiedUser = {
        ...mockClient,
        emailVerified: false,
      };

      userRepository.findOne.mockResolvedValue(unverifiedUser as any);

      await expect(
        service.updateUserRole(unverifiedUser.id, UserRole.TAILOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when upgrading to tailor without business subscription', async () => {
      // Client with only basic subscription
      userRepository.findOne.mockResolvedValue(mockClient as any);

      await expect(
        service.updateUserRole(mockClient.id, UserRole.TAILOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when quota not found', async () => {
      const clientWithSub = {
        ...mockClient,
        subscriptions: [{ status: 'active', stripePriceId: 'price_business' }],
      };

      userRepository.findOne.mockResolvedValue(clientWithSub as any);
      quotaRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateUserRole(clientWithSub.id, UserRole.TAILOR),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
