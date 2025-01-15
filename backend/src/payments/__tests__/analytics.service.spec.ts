import { Test, TestingModule } from '@nestjs/testing';
import { PaymentAnalyticsService } from '../analytics.service';

describe('PaymentAnalyticsService', () => {
  let service: PaymentAnalyticsService;
  let paymentRepository: Repository<Payment>;
  let subscriptionRepository: Repository<Subscription>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentAnalyticsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: createMock<Repository<Payment>>(),
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: createMock<Repository<Subscription>>(),
        },
      ],
    }).compile();

    service = module.get<PaymentAnalyticsService>(PaymentAnalyticsService);
    paymentRepository = module.get<Repository<Payment>>(
      getRepositoryToken(Payment),
    );
    subscriptionRepository = module.get<Repository<Subscription>>(
      getRepositoryToken(Subscription),
    );
  });

  describe('getRevenueMetrics', () => {
    it('should calculate revenue metrics correctly', async () => {
      // Arrange
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockPayments = [{ amount: 100 }, { amount: 200 }, { amount: 300 }];

      jest.spyOn(paymentRepository, 'createQueryBuilder').mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPayments),
      } as any);

      // Act
      const result = await service.getRevenueMetrics(startDate, endDate);

      // Assert
      expect(result.totalRevenue).toBe(600);
      expect(result.averageOrderValue).toBe(200);
      expect(result.transactionCount).toBe(3);
    });
  });
});
