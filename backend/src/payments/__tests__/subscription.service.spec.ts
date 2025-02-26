// /backend/src/payments/__tests__/subscription.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SubscriptionService } from '../subscription.service';
import { Subscription, SubscriptionStatus } from '../entities/subscription.entity';
import { EmailService } from '../../email/email.service';
import { User } from '../../users/entities/user.entity';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepository: Repository<Subscription>;
  let emailService: EmailService;
  let userRepository: Repository<User>;

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    stripeCustomerId: 'cus_123',
  };

  const mockCreateSubscriptionDto = {
    priceId: 'price_123',
    trialDays: 14,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendSubscriptionConfirmation: jest.fn(),
            sendSubscriptionCancellation: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => 'sk_test_1234'),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    subscriptionRepository = module.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    emailService = module.get<EmailService>(EmailService);
    
    // Setup mock Stripe client
    (service as any).stripe = {
      subscriptions: {
        create: jest.fn(),
        update: jest.fn(),
      },
      customers: {
        create: jest.fn(),
      },
    };
  });

  describe('createSubscription', () => {
    it('should create a subscription successfully', async () => {
      const mockStripeSubscription = {
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      // Mock Stripe subscription creation
      (service as any).stripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      
      // Mock repository save
      jest.spyOn(subscriptionRepository, 'save').mockImplementation((subscription) => 
        Promise.resolve({
          id: '1',
          ...subscription,
        })
      );

      // Mock customer creation
      jest.spyOn(service as any, 'getOrCreateCustomer').mockResolvedValue('cus_123');

      const result = await service.createSubscription(
        mockUser as User,
        mockCreateSubscriptionDto,
      );

      expect(result.stripeSubscriptionId).toBe(mockStripeSubscription.id);
      expect(emailService.sendSubscriptionConfirmation).toHaveBeenCalled();
      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubscriptionId: mockStripeSubscription.id,
          status: mockStripeSubscription.status as SubscriptionStatus,
          currentPeriodStart: expect.any(Date),
          currentPeriodEnd: expect.any(Date),
        }),
      );
    });

    it('should handle Stripe subscription creation failure', async () => {
      // Mock Stripe subscription creation failure
      (service as any).stripe.subscriptions.create.mockRejectedValue(
        new Error('Subscription creation failed')
      );

      await expect(
        service.createSubscription(mockUser as User, mockCreateSubscriptionDto),
      ).rejects.toThrow('Subscription creation failed');
    });
    
    it('should handle subscription with coupon', async () => {
      const mockStripeSubscription = {
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      // Mock Stripe subscription creation
      (service as any).stripe.subscriptions.create.mockResolvedValue(mockStripeSubscription);
      
      // Mock customer creation
      jest.spyOn(service as any, 'getOrCreateCustomer').mockResolvedValue('cus_123');

      const subscriptionDto = {
        ...mockCreateSubscriptionDto,
        couponCode: 'DISCOUNT20',
      };

      await service.createSubscription(mockUser as User, subscriptionDto);
      
      expect((service as any).stripe.subscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          coupon: 'DISCOUNT20',
        })
      );
    });
  });

  describe('cancelSubscription', () => {
    const mockSubscription = {
      id: '1',
      stripeSubscriptionId: 'sub_123',
      status: SubscriptionStatus.ACTIVE,
      user: mockUser,
      currentPeriodEnd: new Date(),
    };

    it('should cancel subscription at period end', async () => {
      jest
        .spyOn(subscriptionRepository, 'findOne')
        .mockResolvedValue(mockSubscription as Subscription);

      // Mock Stripe subscription update
      (service as any).stripe.subscriptions.update.mockResolvedValue({
        id: 'sub_123',
        cancel_at_period_end: true,
      });

      await service.cancelSubscription(mockUser as User, '1', false);

      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          cancelAtPeriodEnd: true,
          canceledAt: expect.any(Date),
        }),
      );
      expect(emailService.sendSubscriptionCancellation).toHaveBeenCalled();
    });

    it('should cancel subscription immediately', async () => {
      jest
        .spyOn(subscriptionRepository, 'findOne')
        .mockResolvedValue(mockSubscription as Subscription);

      // Mock Stripe subscription update
      (service as any).stripe.subscriptions.update.mockResolvedValue({
        id: 'sub_123',
        status: 'canceled',
      });

      await service.cancelSubscription(mockUser as User, '1', true);

      expect(subscriptionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SubscriptionStatus.CANCELED,
          canceledAt: expect.any(Date),
        }),
      );
      expect(emailService.sendSubscriptionCancellation).toHaveBeenCalled();
    });

    it('should handle subscription not found', async () => {
      jest.spyOn(subscriptionRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.cancelSubscription(mockUser as User, '1', false),
      ).rejects.toThrow('Subscription not found');
    });
    
    it('should handle Stripe update failure', async () => {
      jest
        .spyOn(subscriptionRepository, 'findOne')
        .mockResolvedValue(mockSubscription as Subscription);

      // Mock Stripe subscription update failure
      (service as any).stripe.subscriptions.update.mockRejectedValue(
        new Error('Subscription update failed')
      );

      await expect(
        service.cancelSubscription(mockUser as User, '1', false),
      ).rejects.toThrow('Subscription update failed');
    });
  });
});