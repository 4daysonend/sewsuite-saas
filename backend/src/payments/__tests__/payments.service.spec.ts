// /backend/src/payments/__tests__/payments.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { PaymentsService } from '../payments.service';
import { Payment, PaymentStatus } from '../entities/payment.entity';
import { OrdersService } from '../../orders/orders.service';
import { EmailService } from '../../email/email.service';

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
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: OrdersService,
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockOrder),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendOrderPaymentConfirmation: jest.fn(),
            sendOrderPaymentFailedNotification: jest.fn(),
          },
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
    paymentRepository = module.get<Repository<Payment>>(getRepositoryToken(Payment));
    ordersService = module.get<OrdersService>(OrdersService);
    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent successfully', async () => {
      const orderId = '123';
      const mockPaymentIntent = {
        id: 'pi_123',
        client_secret: 'secret_123',
        status: 'requires_payment_method',
      };

      jest.spyOn(ordersService, 'findOne').mockResolvedValue(mockOrder);
      jest.spyOn(paymentRepository, 'save').mockResolvedValue({
        id: '1',
        stripePaymentIntentId: mockPaymentIntent.id,
        amount: mockOrder.price,
        status: PaymentStatus.PENDING,
        order: mockOrder,
      } as Payment);

      // Mock Stripe API
      (service as any).stripe = {
        paymentIntents: {
          create: jest.fn().mockResolvedValue(mockPaymentIntent),
        },
      };

      const result = await service.createPaymentIntent(orderId);

      expect(result.clientSecret).toBeDefined();
      expect(paymentRepository.save).toHaveBeenCalled();
    });

    it('should handle errors when creating payment intent', async () => {
      const orderId = '123';
      jest.spyOn(ordersService, 'findOne').mockRejectedValue(new Error('Order not found'));

      await expect(service.createPaymentIntent(orderId)).rejects.toThrow();
    });
  });

  describe('handleWebhook', () => {
    it('should process payment_intent.succeeded webhook', async () => {
      const mockPayment = {
        id: '1',
        stripePaymentIntentId: 'pi_123',
        status: PaymentStatus.PENDING,
        order: mockOrder,
      } as Payment;

      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(mockPayment);
      
      // Mock Stripe webhook construction
      (service as any).stripe = {
        webhooks: {
          constructEvent: jest.fn().mockReturnValue({
            type: 'payment_intent.succeeded',
            data: { object: { id: 'pi_123' } },
          }),
        },
      };

      await service.handleWebhook(
        'signature',
        Buffer.from(
          JSON.stringify({
            type: 'payment_intent.succeeded',
            data: { object: { id: 'pi_123' } },
          }),
        ),
      );

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.COMPLETED }),
      );
      expect(emailService.sendOrderPaymentConfirmation).toHaveBeenCalled();
    });

    it('should handle payment_intent.payment_failed webhook', async () => {
      const mockPayment = {
        id: '1',
        stripePaymentIntentId: 'pi_123',
        status: PaymentStatus.PENDING,
        order: mockOrder,
      } as Payment;

      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(mockPayment);
      
      // Mock Stripe webhook construction
      (service as any).stripe = {
        webhooks: {
          constructEvent: jest.fn().mockReturnValue({
            type: 'payment_intent.payment_failed',
            data: { object: { id: 'pi_123' } },
          }),
        },
      };

      await service.handleWebhook(
        'signature',
        Buffer.from(
          JSON.stringify({
            type: 'payment_intent.payment_failed',
            data: { object: { id: 'pi_123' } },
          }),
        ),
      );

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: PaymentStatus.FAILED }),
      );
      expect(emailService.sendOrderPaymentFailedNotification).toHaveBeenCalled();
    });
  });

  // Error handling tests
  describe('error handling', () => {
    it('should handle invalid webhook signatures', async () => {
      // Mock Stripe webhook construction failure
      (service as any).stripe = {
        webhooks: {
          constructEvent: jest.fn().mockImplementation(() => {
            throw new Error('Invalid signature');
          }),
        },
      };

      await expect(
        service.handleWebhook('invalid_signature', Buffer.from('{}'))
      ).rejects.toThrow();
    });

    it('should handle missing payment records', async () => {
      jest.spyOn(paymentRepository, 'findOne').mockResolvedValue(null);
      
      // Mock Stripe webhook construction
      (service as any).stripe = {
        webhooks: {
          constructEvent: jest.fn().mockReturnValue({
            type: 'payment_intent.succeeded',
            data: { object: { id: 'pi_123' } },
          }),
        },
      };

      await expect(
        service.handleWebhook(
          'signature',
          Buffer.from(
            JSON.stringify({
              type: 'payment_intent.succeeded',
              data: { object: { id: 'pi_123' } },
            }),
          ),
        ),
      ).rejects.toThrow();
    });
  });
});