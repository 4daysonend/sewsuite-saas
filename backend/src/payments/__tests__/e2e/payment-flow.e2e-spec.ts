import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PaymentsModule } from '../../payments.module';

describe('Payment Flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule, PaymentsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should handle complete payment flow', async () => {
    // Create payment intent
    const createResponse = await request(app.getHttpServer())
      .post('/payments/create-intent')
      .send({
        orderId: 'test_order_id',
        amount: 1000
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.clientSecret).toBeDefined();

    // Simulate webhook
    const webhookResponse = await request(app.getHttpServer())
      .post('/payments/webhook')
      .send({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: createResponse.body.paymentIntentId
          }
        }
      });

    expect(webhookResponse.status).toBe(200);
  });
});