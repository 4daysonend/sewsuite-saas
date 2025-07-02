import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    configService: ConfigService, // Remove 'private' to avoid the warning
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    _done: VerifyCallback,
  ): Promise<any> {
    try {
      // Validate Google profile data
      if (!profile.emails?.length) {
        throw new Error(
          'Google authentication failed: Email missing from profile',
        );
      }

      const email = profile.emails[0].value;
      if (!email) {
        throw new Error('Google authentication failed: Invalid email');
      }

      return this.authService.validateOAuthUser({
        email,
        firstName: profile.name?.givenName || '',
        lastName: profile.name?.familyName || '',
        profilePicture: profile.photos?.[0]?.value || '',
        providerId: profile.id,
        provider: 'google',
      });
    } catch (err) {
      console.error('Google authentication error:', err);
      throw err;
    }
  }
}
