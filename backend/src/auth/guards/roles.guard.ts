import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { User as AppUser } from '../../users/entities/user.entity';
import { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';

// Properly extend Express.User interface
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User extends AppUser {} // Extending the User type imported above
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as AppUser | undefined; // Type assertion here

    // If user object is missing, check if we can extract it from the token
    if (!user) {
      this.logger.warn(
        `No user object found in request. Authorization failed for route: ${request.path}`,
      );

      try {
        // Try to extract user from token if the user wasn't attached by previous guards
        const token = this.extractTokenFromHeader(request);
        if (!token) {
          this.logger.warn(
            `No token found in request to route: ${request.path}`,
          );
          throw new UnauthorizedException('Authentication required');
        }

        // Verify and decode the token
        const payload = this.jwtService.verify(token);
        this.logger.debug(
          `Token verification successful for user ID: ${payload.sub}`,
        );

        // Token is valid but we don't have the complete user object
        // This path should generally not occur if JwtAuthGuard is used before RolesGuard
        throw new UnauthorizedException(
          'Valid token but incomplete authentication flow',
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Authentication error: ${errorMessage}`, errorStack);
        throw new UnauthorizedException('Authentication failed');
      }
    }

    // We've already checked that user exists, so it's safe to use non-null assertion
    // Assert user has a role property
    if (!user.role) {
      this.logger.warn(
        `User (ID: ${user.id}) has no role assigned, access denied to route: ${request.path}`,
      );
      throw new ForbiddenException('User has no role assigned');
    }

    // Check if user's role matches any of the required roles
    const hasRequiredRole = requiredRoles.some((role) => user.role === role);

    // Log the authorization result
    if (hasRequiredRole) {
      this.logger.log(
        `User (ID: ${user.id}, Role: ${user.role}) granted access to ${request.method} ${request.path}`,
      );
    } else {
      this.logger.warn(
        `Access denied: User (ID: ${user.id}, Role: ${user.role}) attempted to access ${request.method} ${request.path} which requires roles: [${requiredRoles.join(', ')}]`,
      );
    }

    return hasRequiredRole;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
