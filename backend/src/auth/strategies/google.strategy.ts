import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { GoogleUser } from '../interfaces/auth.interface';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
  ): Promise<GoogleUser> {
    try {
      const { emails, name, photos } = profile;
      
      if (!emails?.[0]?.value) {
        throw new Error('No email found in Google profile');
      }

      return {
        email: emails[0].value,
        firstName: name?.givenName,
        lastName: name?.familyName,
        picture: photos?.[0]?.value,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error(`Google validation error: ${error.message}`);
      throw error;
    }
  }
}