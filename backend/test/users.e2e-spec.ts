// sewsuite-saas/backend/test/users.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../src/users/entities/user.entity';
import { StorageQuota } from '../src/upload/entities/storage-quota.entity';
import { AppModule } from '../src/app.module';
import { CreateUserDto } from '../src/users/dto/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import { In } from 'typeorm';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userRepository: any;
  let quotaRepository: any;

  let clientToken: string;
  let adminToken: string;
  let clientUserId: string;
  let adminUserId: string;

  const mockClientUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'client@example.com',
    password: bcrypt.hashSync('Password123!', 10),
    firstName: 'Client',
    lastName: 'User',
    role: UserRole.CLIENT,
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdminUser = {
    id: '123e4567-e89b-12d3-a456-426614174001',
    email: 'admin@example.com',
    password: bcrypt.hashSync('Admin123!', 10),
    firstName: 'Admin',
    lastName: 'User',
    role: UserRole.ADMIN,
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createUserDto: CreateUserDto = {
    email: 'new@example.com',
    password: 'NewPassword123!',
    firstName: 'New',
    lastName: 'User',
    role: UserRole.CLIENT,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    jwtService = app.get<JwtService>(JwtService);
    userRepository = app.get(getRepositoryToken(User));
    quotaRepository = app.get(getRepositoryToken(StorageQuota));

    // Initialize test users
    await userRepository.save([mockClientUser, mockAdminUser]);

    // Setup quota for users
    await quotaRepository.save([
      {
        user: { id: mockClientUser.id },
        totalSpace: 1073741824, // 1GB
        usedSpace: 0,
      },
      {
        user: { id: mockAdminUser.id },
        totalSpace: 107374182400, // 100GB
        usedSpace: 0,
      },
    ]);

    // Generate JWT tokens
    clientUserId = mockClientUser.id;
    adminUserId = mockAdminUser.id;

    clientToken = jwtService.sign({
      sub: clientUserId,
      email: mockClientUser.email,
      role: UserRole.CLIENT,
    });

    adminToken = jwtService.sign({
      sub: adminUserId,
      email: mockAdminUser.email,
      role: UserRole.ADMIN,
    });
  });

  afterAll(async () => {
    // Clean up test data
    await quotaRepository.delete({});
    await userRepository.delete({ id: In([clientUserId, adminUserId]) });
    await app.close();
  });

  describe('GET /users/:id', () => {
    it('should get client user details', () => {
      return request(app.getHttpServer())
        .get(`/users/${clientUserId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', clientUserId);
          expect(res.body).toHaveProperty('email', mockClientUser.email);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should get admin user details', () => {
      return request(app.getHttpServer())
        .get(`/users/${adminUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', adminUserId);
          expect(res.body).toHaveProperty('role', UserRole.ADMIN);
        });
    });

    it('should return 404 for non-existent user', () => {
      return request(app.getHttpServer())
        .get('/users/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });

    it('should return 401 when not authenticated', () => {
      return request(app.getHttpServer())
        .get(`/users/${clientUserId}`)
        .expect(401);
    });
  });

  describe('POST /users', () => {
    it('should allow admin to create user', () => {
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(createUserDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('email', createUserDto.email);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should not allow client to create user', () => {
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${clientToken}`)
        .send(createUserDto)
        .expect(403);
    });

    it('should validate user input', () => {
      return request(app.getHttpServer())
        .post('/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'invalid-email',
          password: 'short',
        })
        .expect(400);
    });
  });

  describe('PUT /users/:id', () => {
    it('should update own profile', () => {
      return request(app.getHttpServer())
        .put(`/users/${clientUserId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('firstName', 'Updated');
          expect(res.body).toHaveProperty('lastName', 'Name');
        });
    });

    it('should not update email without password verification', () => {
      return request(app.getHttpServer())
        .put(`/users/${clientUserId}`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          email: 'updated@example.com',
        })
        .expect(400);
    });
  });

  describe('PATCH /users/:id/password', () => {
    it('should update password with correct current password', () => {
      return request(app.getHttpServer())
        .patch(`/users/${clientUserId}/password`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          currentPassword: 'Password123!',
          newPassword: 'NewPassword456!',
        })
        .expect(204);
    });

    it('should reject password update with incorrect current password', () => {
      return request(app.getHttpServer())
        .patch(`/users/${clientUserId}/password`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword789!',
        })
        .expect(400);
    });
  });

  describe('PATCH /users/:id/preferences', () => {
    it('should update user preferences', () => {
      return request(app.getHttpServer())
        .patch(`/users/${clientUserId}/preferences`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({
          theme: 'dark',
          notifications: {
            email: false,
          },
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.preferences).toHaveProperty('theme', 'dark');
          expect(res.body.preferences.notifications).toHaveProperty(
            'email',
            false,
          );
        });
    });
  });

  describe('GET /users/:id/quota', () => {
    it('should get user storage quota', () => {
      return request(app.getHttpServer())
        .get(`/users/${clientUserId}/quota`)
        .set('Authorization', `Bearer ${clientToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('totalSpace');
          expect(res.body).toHaveProperty('usedSpace');
        });
    });
  });
});
