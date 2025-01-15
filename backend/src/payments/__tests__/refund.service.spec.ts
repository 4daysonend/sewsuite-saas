import { Test, TestingModule } from '@nestjs/testing';
import { RefundService } from '../refund.service';
import { Payment } from '../entities/payment.entity';

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
          useValue: createMock<Repository<Payment>>(),
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

    service = module.get<RefundService>(RefundService);
    paymentRepository = module.get<Repository<Payment>>(
      getRepositoryToken(Payment),
    );
    emailService = module.get<EmailService>(EmailService);
  });

  describe('createRefund', () => {
    it('should process refund successfully', async () => {
      // Arrange
      jest
        .spyOn(paymentRepository, 'findOne')
        .mockResolvedValue(mockPayment as Payment);

      const mockRefund = {
        id: 're_123',
        amount: 1000,
      };

      // Act
      const result = await service.createRefund(
        mockPayment.id,
        mockRefund.amount,
      );

      // Assert
      expect(result.status).toBe(PaymentStatus.REFUNDED);
      expect(emailService.sendRefundNotification).toHaveBeenCalled();
    });
  });
});
