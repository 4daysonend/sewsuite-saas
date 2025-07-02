import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import * as bcrypt from 'bcryptjs';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let userRepository: any;
  let jwtToken: string;

  const testUser = {
    email: 'e2e-test@example.com',
    password: 'Password123!',
    firstName: 'E2E',
    lastName: 'Test',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));
    
    await app.init();

    // Get repository to seed test data
    userRepository = app.get(getRepositoryToken(User));
    
    // Clean up any existing test users
    await userRepository.delete({ email: testUser.email });
  });

  afterAll(async () => {
    // Clean up test data
    await userRepository.delete({ email: testUser.email });
    await app.close();
  });

  describe('Authentication', () => {
    it('/auth/register (POST) - should register a new user', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test', 
        lastName: 'User'
      };
      
      // Act
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(userData);
        
      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(userData.email);
    });

    it('/auth/register (POST) - should fail with invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toContain('email');
        });
    });

    it('/auth/login (POST) - should login with valid credentials', async () => {
      // First ensure the user exists with a known password
      const hashedPassword = await bcrypt.hash(testUser.password, 10);
      await userRepository.save({
        ...testUser,
        password: hashedPassword,
      });

      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body.user).toHaveProperty('email', testUser.email);
          jwtToken = res.body.access_token;
        });
    });

    it('/auth/login (POST) - should fail with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('Protected Routes', () => {
    it('/users/me (GET) - should return current user profile when authenticated', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', testUser.email);
          expect(res.body).toHaveProperty('firstName', testUser.firstName);
        });
    });

    it('/users/me (GET) - should fail without authentication', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .expect(401);
    });
  });
});

