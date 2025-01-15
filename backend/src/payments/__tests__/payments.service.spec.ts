import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PaymentsService } from '../payments.service';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { OrdersService } from '../../orders/orders.service';
import { EmailService } from '../../email/email.service';
import { createMock } from '@golevelup/ts-jest';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepository: Repository<Payment>;
  let ordersService: OrdersService;
  let emailService: EmailService;
  let configService: ConfigService;

  const mockOrder = {
    id: '123',
    price: 100,
    client: {
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: createMock<Repository<Payment>>(),
        },
        {
          provide: OrdersService,
          useValue: createMock<OrdersService>(),
        },
        {
          provide: EmailService,
          useValue: createMock<EmailService>(),
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_1234';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepository = module.get<Repository<Payment>>(
      getRepositoryToken(Payment),
    );
    ordersService = module.get<OrdersService>(OrdersService);
    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent successfully', async () => {
      // Arrange
      const orderId = '123';
      const mockPaymentIntent = {
        id: 'pi_123',
        client_secret: 'secret_123',
        status: 'requires_payment_method',
      };

      jest.spyOn(ordersService, 'findById').mockResolvedValue(mockOrder);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue({
        id: '1',
        stripePaymentIntentId: mockPaymentIntent.id,
        amount: mockOrder.price,
        status: PaymentStatus.PENDING,
        order: mockOrder,
      } as Payment);

      // Act
      const result = await service.createPaymentIntent(orderId);

      // Assert
      expect(result.clientSecret).toBeDefined();
      expect(paymentRepository.save).toHaveBeenCalled();
    });

    it('should handle errors when creating payment intent', async () => {
      // Arrange
      const orderId = '123';
      jest
        .spyOn(ordersService, 'findById')
        .mockRejectedValue(new Error('Order not found'));

      // Act & Assert
      await expect(service.createPaymentIntent(orderId)).rejects.toThrow();
    });
  });

  describe('handleWebhook', () => {
    it('should process payment_intent.succeeded webhook', async () => {
      // Arrange
      const mockPayment = {
        id: '1',
        stripePaymentIntentId: 'pi_123',
        status: PaymentStatus.PENDING,
        order: mockOrder,
      };

      jest
        .spyOn(paymentRepository, 'findOne')
        .mockResolvedValue(mockPayment as Payment);

      // Act
      await service.handleWebhook(
        'signature',
        Buffer.from(
          JSON.stringify({
            type: 'payment_intent.succeeded',
            data: { object: { id: 'pi_123' } },
          }),
        ),
      );

      // Assert
      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.COMPLETED }),
      );
      expect(emailService.sendPaymentConfirmation).toHaveBeenCalled();
    });
  });
});
