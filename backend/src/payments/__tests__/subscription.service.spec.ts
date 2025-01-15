import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionService } from '../subscription.service';
import {
  Subscription,
  SubscriptionStatus,
} from '../entities/subscription.entity';
import { EmailService } from '../../email/email.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let subscriptionRepository: Repository<Subscription>;
  let emailService: EmailService;

  const mockUser = {
    id: '123',
    email: 'test@example.com',
    stripeCustomerId: 'cus_123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: createMock<Repository<Subscription>>(),
        },
        {
          provide: EmailService,
          useValue: createMock<EmailService>(),
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
    emailService = module.get<EmailService>(EmailService);
  });

  describe('createSubscription', () => {
    it('should create a subscription successfully', async () => {
      // Arrange
      const createSubscriptionDto = {
        priceId: 'price_123',
        trialDays: 14,
      };

      const mockStripeSubscription = {
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      };

      jest.spyOn(subscriptionRepository, 'save').mockResolvedValue({
        id: '1',
        stripeSubscriptionId: mockStripeSubscription.id,
        status: SubscriptionStatus.ACTIVE,
        user: mockUser,
      } as Subscription);

      // Act
      const result = await service.createSubscription(
        mockUser,
        createSubscriptionDto,
      );

      // Assert
      expect(result.stripeSubscriptionId).toBeDefined();
      expect(emailService.sendSubscriptionConfirmation).toHaveBeenCalled();
    });
  });
});
