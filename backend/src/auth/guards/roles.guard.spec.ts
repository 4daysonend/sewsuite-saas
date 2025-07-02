import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { createMock } from '@golevelup/ts-jest';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get<Reflector>(Reflector);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when no roles are required', async () => {
    // Mock reflector to return undefined roles
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMock<ExecutionContext>();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when user has required role', async () => {
    // Mock reflector to return required roles
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const mockRequest = {
      user: {
        id: 1,
        role: 'admin',
      },
      path: '/admin/users',
      method: 'GET',
    };

    const context = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should deny access when user does not have required role', async () => {
    // Mock reflector to return required roles
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const mockRequest = {
      user: {
        id: 1,
        role: 'user',
      },
      path: '/admin/users',
      method: 'GET',
    };

    const context = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
  });

  it('should throw UnauthorizedException when no user in request', async () => {
    // Mock reflector to return required roles
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const mockRequest = {
      user: undefined,
      headers: {
        authorization: undefined,
      },
      path: '/admin/users',
      method: 'GET',
    };

    const context = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw ForbiddenException when user has no role', async () => {
    // Mock reflector to return required roles
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const mockRequest = {
      user: {
        id: 1,
        role: undefined, // User has no role
      },
      path: '/admin/users',
      method: 'GET',
    };

    const context = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should attempt to extract token when user is missing', async () => {
    // Mock reflector to return required roles
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    // Mock valid JWT token
    const mockToken = 'valid.jwt.token';
    jest.spyOn(jwtService, 'verify').mockReturnValue({ sub: 1 });

    const mockRequest = {
      user: undefined,
      headers: {
        authorization: `Bearer ${mockToken}`,
      },
      path: '/admin/users',
      method: 'GET',
    };

    const context = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    });

    // Should still throw because even though token is valid, we don't have complete user info
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.verify).toHaveBeenCalledWith(mockToken);
  });

  it('should handle invalid token format', async () => {
    // Mock reflector to return required roles
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    const mockRequest = {
      user: undefined,
      headers: {
        authorization: 'InvalidFormat token123', // Not a Bearer token
      },
      path: '/admin/users',
      method: 'GET',
    };

    const context = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('should handle token verification errors', async () => {
    // Mock reflector to return required roles
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);

    // Mock JWT service to throw an error
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      throw new Error('Token expired');
    });

    const mockRequest = {
      user: undefined,
      headers: {
        authorization: 'Bearer expired.token',
      },
      path: '/admin/users',
      method: 'GET',
    };

    const context = createMock<ExecutionContext>({
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
