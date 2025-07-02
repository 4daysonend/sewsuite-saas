import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../src/users/entities/user.entity';
import { UsersService } from '../src/users/users.service';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let usersService: UsersService;
  
  // Mock user data
  const adminUser = {
    id: 1,
    email: 'admin@example.com',
    password: 'hashed_password',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    isActive: true,
  };

  const regularUser = {
    id: 2,
    email: 'user@example.com',
    password: 'hashed_password',
    firstName: 'Regular',
    lastName: 'User',
    role: 'user',
    isActive: true,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User],
          synchronize: true,
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    jwtService = app.get<JwtService>(JwtService);
    usersService = app.get<UsersService>(UsersService);
    
    // Mock the user repository
    const userRepository = app.get(getRepositoryToken(User));
    
    // Setup mock users
    jest.spyOn(userRepository, 'findOneBy').mockImplementation(async (criteria) => {
      if (criteria.id === 1) return adminUser;
      if (criteria.id === 2) return regularUser;
      return null;
    });
    
    jest.spyOn(usersService, 'findOne').mockImplementation(async (id) => {
      if (id === 1) return adminUser;
      if (id === 2) return regularUser;
      return null;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Protected routes', () => {
    let adminToken: string;
    let userToken: string;

    beforeEach(() => {
      // Generate valid JWT tokens for our test users
      adminToken = jwtService.sign({ sub: adminUser.id, email: adminUser.email });
      userToken = jwtService.sign({ sub: regularUser.id, email: regularUser.email });
    });

    it('should allow admin access to admin-only route', () => {
      return request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should deny regular user access to admin-only route', () => {
      return request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should deny access with no token', () => {
      return request(app.getHttpServer())
        .get('/admin/dashboard')
        .expect(401);
    });

    it('should deny access with invalid token', () => {
      return request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });

    it('should allow both admin and user access to user route', () => {
      // Test with admin token
      const adminRequest = request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Test with regular user token
      const userRequest = request(app.getHttpServer())
        .get('/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      return Promise.all([adminRequest, userRequest]);
    });

    it('should handle expired tokens properly', async () => {
      // Generate an expired token
      const expiredToken = jwtService.sign(
        { sub: adminUser.id, email: adminUser.email },
        { expiresIn: '0s' } // Immediately expired
      );
      
      // Wait a moment to ensure token is expired
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return request(app.getHttpServer())
        .get('/admin/dashboard')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });
});