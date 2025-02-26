// /backend/src/payments/_test_/analytics.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentAnalyticsService } from '../analytics.service';
import { Payment } from '../entities/payment.entity';
import { Subscription } from '../entities/subscription.entity';

describe('PaymentAnalyticsService', () => {
  let service: PaymentAnalyticsService;
  let paymentRepository: Repository<Payment>;
  let subscriptionRepository: Repository<Subscription>;

  const mockPayments = [
    { amount: 100, createdAt: new Date('2025-01-01') },
    { amount: 200, createdAt: new Date('2025-01-02') },
    { amount: 300, createdAt: new Date('2025-01-03') }
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentAnalyticsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue(mockPayments),
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              groupBy: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getRawMany: jest.fn().mockResolvedValue([]),
              getRawOne: jest.fn().mockResolvedValue({ count: '3' })
            }))
          }
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            count: jest.fn(),
            find: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<PaymentAnalyticsService>(PaymentAnalyticsService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    subscriptionRepository = module.get<Repository<Subscription>>(getRepositoryToken(Subscription));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRevenueMetrics', () => {
    it('should calculate revenue metrics correctly', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const result = await service.getRevenueMetrics(startDate, endDate);

      expect(result.totalRevenue).toBe(600);
      expect(result.averageOrderValue).toBe(200);
      expect(result.transactionCount).toBe(3);
    });

    it('should handle empty results', async () => {
      jest.spyOn(paymentRepository, 'createQueryBuilder').mockImplementation(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue({ count: '0' })
      } as any));

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const result = await service.getRevenueMetrics(startDate, endDate);

      expect(result.totalRevenue).toBe(0);
      expect(result.averageOrderValue).toBe(0);
      expect(result.transactionCount).toBe(0);
    });
  });

  describe('getSubscriptionMetrics', () => {
    const mockActiveSubscriptions = 10;
    const mockTotalSubscriptions = 15;

    beforeEach(() => {
      jest.spyOn(subscriptionRepository, 'count').mockImplementation((criteria: any) => {
        if (criteria?.where?.status === 'active') {
          return Promise.resolve(mockActiveSubscriptions);
        }
        return Promise.resolve(mockTotalSubscriptions);
      });
    });

    it('should return correct subscription metrics', async () => {
      const result = await service.getSubscriptionMetrics();

      expect(result.activeSubscriptions).toBe(mockActiveSubscriptions);
      expect(result.totalSubscriptions).toBe(mockTotalSubscriptions);
      expect(result.churnRate).toBeDefined();
      expect(result.monthlyRecurringRevenue).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle repository errors gracefully', async () => {
      jest.spyOn(paymentRepository, 'createQueryBuilder').mockImplementation(() => {
        throw new Error('Database error');
      });

      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      await expect(service.getRevenueMetrics(startDate, endDate)).rejects.toThrow();
    });
  });
});