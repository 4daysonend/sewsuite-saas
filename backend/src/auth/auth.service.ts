import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { User as UserEntity } from '../users/entities/user.entity';
import {
  JwtPayload,
  AuthResponse,
  GoogleUser,
  AuthUser,
} from './interfaces/auth.interface';
import * as crypto from 'crypto';

// Update the interface definition
interface OAuthUser {
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string; // Make sure this matches what you're using
  providerId: string;
  provider: string;
}

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger = new Logger(AuthService.name),
  ) {
    this.SALT_ROUNDS = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 10);
  }

  async validateUser(email: string, password: string): Promise<any> {
    // Find user by email
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    // Check if user has a password (might not if they registered via OAuth)
    if (!user.password) {
      this.logger.warn(
        `User ${user.id} tried to login with password but has no password set`,
      );
      return null;
    }

    // Compare passwords using bcryptjs
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (isPasswordValid) {
      // Remove password from result
      const { password: _, ...result } = user;
      return result;
    }

    return null;
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    try {
      const existingUser = await this.usersService.findByEmail(
        registerDto.email,
      );
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const { password, ...userData } = registerDto;

      const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);

      const newUser = await this.usersService.create({
        ...userData,
        password: hashedPassword,
      });

      return this.generateAuthResponse(newUser);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Error during registration: ${(error as any).message}`);
      throw new InternalServerErrorException('Error during registration');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    try {
      // Validate credentials using the existing validateUser method
      const user = await this.validateUser(loginDto.email, loginDto.password);

      // Check if validation failed
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Update last login timestamp
      await this.usersService.updateLastLogin(user.id);

      // Generate authentication response with token
      const nameParts = user.fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return this.generateAuthResponse({
        id: user.id,
        email: user.email,
        firstName: firstName,
        lastName: lastName,
        role: user.role,
        createdAt: user.createdAt,
      });
    } catch (error) {
      this.logger.error(`Login failed: ${(error as any).message}`);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('Login process failed');
    }
  }

  async validateGoogleUser(googleUser: GoogleUser): Promise<AuthResponse> {
    try {
      let user = await this.usersService.findByEmail(googleUser.email);

      if (!user) {
        // Create a new user with Google credentials
        user = await this.usersService.create({
          email: googleUser.email,
          firstName: googleUser.firstName,
          lastName: googleUser.lastName,
          oauthProvider: 'google',
          oauthProviderId: googleUser.accessToken,
          isVerified: true, // Google emails are verified
        });
      } else if (!user.oauthProviderId) {
        // Link existing account with Google
        user = await this.usersService.update(user.id, {
          oauthProviderId: googleUser.accessToken,
          oauthProvider: 'google',
          isVerified: true,
        });
      }

      return this.generateAuthResponse(user);
    } catch (error) {
      this.logger.error(
        `Error during Google authentication: ${(error as any).message}`,
      );
      throw new InternalServerErrorException(
        'Error during Google authentication',
      );
    }
  }

  async validateOAuthUser(oauthUser: OAuthUser): Promise<any> {
    // Check if user exists
    let user = await this.usersService.findByEmail(oauthUser.email);

    if (!user) {
      // Create a new user if none exists
      user = await this.usersService.create({
        email: oauthUser.email,
        firstName: oauthUser.firstName || '',
        lastName: oauthUser.lastName || '',
        profilePicture: oauthUser.profilePicture, // Use the correct property name from CreateUserDto
        // Generate a random secure password that the user won't know
        // (they'll use OAuth to login)
        password: crypto.randomBytes(32).toString('hex'),
        oauthProvider: oauthUser.provider,
        oauthProviderId: oauthUser.providerId,
        isVerified: true, // OAuth users are verified by the provider
      });
    } else if (!user.oauthProviderId) {
      // Update existing user with OAuth info if they didn't have it
      await this.usersService.update(user.id, {
        oauthProvider: oauthUser.provider,
        oauthProviderId: oauthUser.providerId,
        profilePicture: user.profilePicture || oauthUser.profilePicture, // Use the correct property name
      });
    }

    // Return user without password
    const { password: _password, ...result } = user;
    return result;
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch (error) {
      this.logger.error(`Token verification failed: ${(error as any).message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  async hashPassword(password: string): Promise<string> {
    // Get the salt rounds from config, default to 10
    const saltRounds =
      this.configService.get<number>('BCRYPT_SALT_ROUNDS') || 10;

    // Generate salt and hash password
    return bcrypt.hash(password, saltRounds);
  }

  private generateAuthResponse(user: AuthUser | UserEntity): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Construct fullName from firstName and lastName
    const fullName =
      user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.lastName || '';

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: fullName, // Use the constructed fullName
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }
}
