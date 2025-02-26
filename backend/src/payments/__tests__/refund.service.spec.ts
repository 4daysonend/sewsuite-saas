// /backend/src/payments/__tests__/refund.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RefundService } from '../refund.service';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { EmailService } from '../../email/email.service';

describe('RefundService', () => {
  let service: RefundService;
  let paymentRepository: Repository<Payment>;
  let emailService: EmailService;

  const mockPayment = {
    id: '1',
    stripePaymentIntentId: 'pi_123',
    amount: 1000,
    order: {
      id: '123',
      client: {
        email: 'test@example.com',
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendRefundNotification: jest.fn(),
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

    service = module.get<RefundService>(RefundService);
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    emailService = module.get<EmailService>(EmailService);
    
    // Setup mock Stripe client
    (service as any).stripe = {
      refunds: {
        create: jest.fn(),
      },
    };
  });

  describe('createRefund', () => {
    it('should process refund successfully', async () => {
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(mockPayment as Payment);

      const mockRefund = {
        id: 're_123',
        amount: 1000,
      };

      // Mock Stripe refund creation
      (service as any).stripe.refunds.create.mockResolvedValue(mockRefund);
      
      // Mock repository save
      jest.spyOn(paymentRepository, 'save').mockImplementation((payment) => 
        Promise.resolve({
          ...payment,
          status: PaymentStatus.REFUNDED
        } as Payment)
      );

      const result = await service.createRefund(mockPayment.id, mockRefund.amount);

      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(emailService.sendRefundNotification).toHaveBeenCalled();
      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.REFUNDED,
          metadata: expect.objectContaining({
            refundId: mockRefund.id,
          }),
        }),
      );
    });

    it('should handle payment not found', async () => {
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(null);

      await expect(service.createRefund('invalid_id', 1000)).rejects.toThrow('Payment not found');
    });

    it('should handle Stripe refund failure', async () => {
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(mockPayment as Payment);

      // Mock Stripe refund failure
      (service as any).stripe.refunds.create.mockRejectedValue(
        new Error('Refund failed')
      );

      await expect(service.createRefund(mockPayment.id, 1000)).rejects.toThrow('Refund failed');
    });
    
    it('should handle partial refunds', async () => {
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(mockPayment as Payment);

      const mockRefund = {
        id: 're_123',
        amount: 500,
      };

      // Mock Stripe refund creation
      (service as any).stripe.refunds.create.mockResolvedValue(mockRefund);
      
      const result = await service.createRefund(mockPayment.id, mockRefund.amount);

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            refundAmount: mockRefund.amount,
          }),
        }),
      );
    });
  });
});