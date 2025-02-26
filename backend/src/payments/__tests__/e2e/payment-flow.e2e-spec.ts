// /backend/src/payments/_test_/e2e/payment-flow.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PaymentsModule } from '../../payments.module';
import { setupApp } from '../../../setup-app';

describe('Payment Flow (e2e)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, PaymentsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app); // Apply global middleware and settings
    await app.init();

    // Get auth token for protected routes
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: process.env.TEST_USER_EMAIL,
        password: process.env.TEST_USER_PASSWORD,
      });

    authToken = loginResponse.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Payment Intent Creation', () => {
    it('should create a payment intent', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: 'test_order_id',
          amount: 1000,
        });

      expect(response.status).toBe(201);
      expect(response.body.clientSecret).toBeDefined();
      expect(response.body.paymentIntentId).toBeDefined();
    });

    it('should handle invalid order ID', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: 'invalid_order_id',
          amount: 1000,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('Webhook Handling', () => {
    it('should process successful payment webhook', async () => {
      const webhookResponse = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Stripe-Signature', 'test_signature')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test_123',
              amount: 1000,
              status: 'succeeded',
            },
          },
        });

      expect(webhookResponse.status).toBe(200);
    });

    it('should handle failed payment webhook', async () => {
      const webhookResponse = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Stripe-Signature', 'test_signature')
        .send({
          type: 'payment_intent.payment_failed',
          data: {
            object: {
              id: 'pi_test_123',
              amount: 1000,
              status: 'failed',
            },
          },
        });

      expect(webhookResponse.status).toBe(200);
    });

    it('should reject invalid webhook signatures', async () => {
      const webhookResponse = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Stripe-Signature', 'invalid_signature')
        .send({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_test_123',
            },
          },
        });

      expect(webhookResponse.status).toBe(400);
    });
  });

  describe('Refund Flow', () => {
    it('should process refund request', async () => {
      const refundResponse = await request(app.getHttpServer())
        .post('/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentId: 'test_payment_id',
          amount: 1000,
          reason: 'requested_by_customer',
        });

      expect(refundResponse.status).toBe(200);
      expect(refundResponse.body.status).toBe('refunded');
    });
  });
});