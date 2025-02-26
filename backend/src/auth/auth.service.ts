import { 
  Injectable, 
  UnauthorizedException, 
  ConflictException, 
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from '../users/entities/user.entity';
import { JwtPayload, AuthResponse, GoogleUser } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SALT_ROUNDS: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.SALT_ROUNDS = this.configService.get<number>('BCRYPT_SALT_ROUNDS', 10);
  }

  async validateUser(email: string, password: string): Promise<Omit<AuthResponse['user'], 'access_token'> | null> {
    try {
      const user = await this.usersService.findByEmail(email);
      
      if (!user) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return null;
      }

      const { password: _, ...result } = user;
      return result;
    } catch (error) {
      this.logger.error(`Error validating user credentials: ${error.message}`);
      throw new InternalServerErrorException('Error validating user credentials');
    }
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    try {
      const existingUser = await this.usersService.findByEmail(registerDto.email);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const { password, ...userData } = registerDto;
      
      const hashedPassword = await bcrypt.hash(
        password,
        this.SALT_ROUNDS
      );

      const newUser = await this.usersService.create({
        ...userData,
        password: hashedPassword,
      });

      return this.generateAuthResponse(newUser);

    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Error during registration: ${error.message}`);
      throw new InternalServerErrorException('Error during registration');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    try {
      const user = await this.validateUser(loginDto.email, loginDto.password);
      
      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      return this.generateAuthResponse(user);

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Error during login: ${error.message}`);
      throw new InternalServerErrorException('Error during login');
    }
  }

  async validateGoogleUser(googleUser: GoogleUser): Promise<AuthResponse> {
    try {
      let user = await this.usersService.findByEmail(googleUser.email);

      if (!user) {
        user = await this.usersService.create({
          email: googleUser.email,
          firstName: googleUser.firstName,
          lastName: googleUser.lastName,
          googleId: googleUser.accessToken,
          emailVerified: true,
        });
      }

      return this.generateAuthResponse(user);

    } catch (error) {
      this.logger.error(`Error during Google authentication: ${error.message}`);
      throw new InternalServerErrorException('Error during Google authentication');
    }
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch (error) {
      this.logger.error(`Token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  private generateAuthResponse(user: any): AuthResponse {
    const payload: JwtPayload = { 
      sub: user.id, 
      email: user.email,
      role: user.role
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        createdAt: user.createdAt
      }
    };
  }
}