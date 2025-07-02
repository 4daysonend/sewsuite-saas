import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { EnvironmentService } from '../config/env.config';
import { AuthorizationService } from './services/authorization.service';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ConfigModule,
    DiscoveryModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (
        configService: ConfigService,
      ): Promise<JwtModuleOptions> => {
        const envService = new EnvironmentService(configService);
        const jwtConfig = await envService.getJwtConfig();

        return {
          secret: jwtConfig.secret as string,
          signOptions: { expiresIn: jwtConfig.expiresIn as string },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    GoogleStrategy,
    EnvironmentService,
    AuthorizationService,
    RolesGuard,
  ],
  exports: [AuthService, JwtModule, RolesGuard],
})
export class AuthModule implements OnModuleInit {
  constructor(private readonly authorizationService: AuthorizationService) {}

  onModuleInit() {
    // Validate security configuration at application startup
    if (process.env.NODE_ENV !== 'test') {
      // Skip in test environment to avoid noise in test output
      this.authorizationService.validateSecurityConfiguration();
    }
  }
}
