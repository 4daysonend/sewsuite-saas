import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/**
 * Local authentication strategy using username and password
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email', // Use email instead of username
      passwordField: 'password',
    });
  }

  /**
   * Validate user credentials
   * @param email User email
   * @param password User password
   * @returns Authenticated user
   */
  async validate(email: string, password: string): Promise<any> {
    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase();

    // Validate credentials using auth service
    const user = await this.authService.validateUser(normalizedEmail, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Return user without password
    const { password: _, ...result } = user;
    return result;
  }
}
