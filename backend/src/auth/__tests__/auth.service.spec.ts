import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

// Mock the bcrypt library
jest.mock('bcryptjs');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  // Mock data
  const mockUser = {
    id: '123',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'Test',
    lastName: 'User',
    role: 'user',
    oauthProviderId: null,
    profilePicture: null,
    createdAt: new Date(),
  };

  const mockJwtToken = 'mocked.jwt.token';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateLastLogin: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(() => mockJwtToken),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === 'BCRYPT_SALT_ROUNDS') return 10;
              return null;
            }),
          },
        },
        {
          provide: 'Logger',
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user object without password when credentials are valid', async () => {
      // Arrange
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.password).toBeUndefined();
      expect(result.id).toBe(mockUser.id);
      expect(usersService.findByEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('should return null when user is not found', async () => {
      // Arrange
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);

      // Act
      const result = await service.validateUser(
        'nonexistent@example.com',
        'password123',
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      // Arrange
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      // Assert
      expect(result).toBeNull();
    });

    it('should return null when user has no password (OAuth user)', async () => {
      // Arrange
      const oauthUser = { ...mockUser, password: null };
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(oauthUser);

      // Act
      const result = await service.validateUser(
        'test@example.com',
        'anypassword',
      );

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('register', () => {
    it('should create a new user and return auth response', async () => {
      // Arrange
      const registerDto = {
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      jest.spyOn(usersService, 'create').mockResolvedValue({
        id: '456',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: 'user',
        createdAt: new Date(),
      });

      // Act
      const result = await service.register(registerDto);

      // Assert
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(registerDto.email);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: registerDto.email,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          password: 'hashedPassword',
        }),
      );
    });

    it('should throw ConflictException when email already exists', async () => {
      // Arrange
      const registerDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Existing',
        lastName: 'User',
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);

      // Act & Assert
      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should return auth token when credentials are valid', async () => {
      // Arrange
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        fullName: `${mockUser.firstName} ${mockUser.lastName}`,
        role: mockUser.role,
        createdAt: mockUser.createdAt,
      });

      // Act
      const result = await service.login(loginDto);

      // Assert
      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe(mockJwtToken);
      expect(result).toHaveProperty('user');
      expect(usersService.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      // Arrange
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(null);

      // Act & Assert
      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateOAuthUser', () => {
    it('should create a new user when email does not exist', async () => {
      // Arrange
      const oauthUser = {
        email: 'oauth@example.com',
        firstName: 'OAuth',
        lastName: 'User',
        profilePicture: 'https://example.com/pic.jpg',
        providerId: 'google-123',
        provider: 'google',
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(usersService, 'create').mockResolvedValue({
        ...oauthUser,
        id: '789',
        role: 'user',
        password: 'randomhash',
        isVerified: true,
        createdAt: new Date(),
      });

      // Act
      const result = await service.validateOAuthUser(oauthUser);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(oauthUser.email);
      expect(result.password).toBeUndefined();
      expect(usersService.create).toHaveBeenCalled();
    });

    it('should update existing user when oauth provider ID is missing', async () => {
      // Arrange
      const oauthUser = {
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        profilePicture: 'https://example.com/pic.jpg',
        providerId: 'google-123',
        provider: 'google',
      };

      const existingUser = {
        id: '123',
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
        profilePicture: null,
        oauthProviderId: null,
        password: 'hashedpassword',
        role: 'user',
        createdAt: new Date(),
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(existingUser);
      jest.spyOn(usersService, 'update').mockResolvedValue({
        ...existingUser,
        oauthProviderId: oauthUser.providerId,
        oauthProvider: oauthUser.provider,
      });

      // Act
      const result = await service.validateOAuthUser(oauthUser);

      // Assert
      expect(result).toBeDefined();
      expect(result.email).toBe(existingUser.email);
      expect(result.password).toBeUndefined();
      expect(usersService.update).toHaveBeenCalledWith(
        existingUser.id,
        expect.objectContaining({
          oauthProviderId: oauthUser.providerId,
          oauthProvider: oauthUser.provider,
        }),
      );
    });
  });

  describe('verifyToken', () => {
    it('should return payload when token is valid', async () => {
      // Arrange
      const mockPayload = {
        sub: '123',
        email: 'test@example.com',
        role: 'user',
      };
      jest.spyOn(jwtService, 'verify').mockReturnValue(mockPayload);

      // Act
      const result = await service.verifyToken('valid.token.here');

      // Assert
      expect(result).toEqual(mockPayload);
      expect(jwtService.verify).toHaveBeenCalledWith('valid.token.here');
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      // Arrange
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(service.verifyToken('invalid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
