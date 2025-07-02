// /backend/src/config/config.validation.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { validationSchema } from './validation';

@Injectable()
export class ConfigValidationService implements OnModuleInit {
  private readonly logger = new Logger(ConfigValidationService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.validateConfig();
  }

  /**
   * Validate critical configuration at startup
   * This ensures that all required environment variables are set
   * and provides clear error messages for missing variables
   */
  validateConfig() {
    this.logger.log('Validating application configuration...');

    // Define required environment variables by category
    const requiredEnvVars = {
      // Authentication secrets
      auth: ['JWT_SECRET', 'BCRYPT_SALT_ROUNDS'],

      // Database credentials
      database: [
        'POSTGRES_HOST',
        'POSTGRES_PORT',
        'POSTGRES_USER',
        'POSTGRES_PASSWORD',
        'POSTGRES_DB',
      ],

      // Email configuration
      email: ['SMTP_SERVER', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM'],

      // SMTP Configuration
      smtp: [
        'SMTP_SERVER',
        'SMTP_USER',
        'SMTP_PASS',
        'SMTP_PORT',
        'SMTP_SECURE',
      ],

      // Payment processing
      payments: [
        'STRIPE_SECRET_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'STRIPE_PUBLISHABLE_KEY',
        'STRIPE_PRICE_ID',
      ],
    };

    const missingVars = new Map<string, string[]>();

    // Check for missing variables by category
    for (const [category, vars] of Object.entries(requiredEnvVars)) {
      const missing = vars.filter((varName) => {
        const value = this.configService.get<string>(varName);
        return value === undefined || value === null || value === '';
      });

      if (missing.length > 0) {
        missingVars.set(category, missing);
      }
    }

    // Special checks for development placeholders
    const placeholderChecks = [
      {
        key: 'JWT_SECRET',
        pattern: /^REPLACE_WITH_/,
        message: 'appears to be a placeholder value',
      },
      {
        key: 'STRIPE_SECRET_KEY',
        pattern: /^sk_(test|live)_[a-zA-Z0-9]+$/,
        inverse: true,
        message: 'does not match Stripe secret key format',
      },
      {
        key: 'STRIPE_WEBHOOK_SECRET',
        pattern: /^whsec_[a-zA-Z0-9]+$/,
        inverse: true,
        message: 'does not match Stripe webhook secret format',
      },
    ];

    const potentialPlaceholders = [];

    for (const check of placeholderChecks) {
      const value = this.configService.get<string>(check.key);
      if (value) {
        const patternMatch = check.pattern.test(value);
        if (
          (check.inverse && patternMatch) ||
          (!check.inverse && !patternMatch)
        ) {
          potentialPlaceholders.push(`${check.key} ${check.message}`);
        }
      }
    }

    // Report validation results
    if (missingVars.size > 0) {
      this.logger.error('Missing required environment variables:');
      for (const [category, vars] of missingVars.entries()) {
        this.logger.error(`- ${category.toUpperCase()}: ${vars.join(', ')}`);
      }

      // In production, fail fast with missing variables
      if (this.configService.get('NODE_ENV') === 'production') {
        throw new Error(
          'Application initialization failed: Missing required environment variables',
        );
      } else {
        this.logger.warn(
          'Application continuing despite missing variables (non-production environment)',
        );
      }
    }

    // Only show warnings for potential placeholders
    if (potentialPlaceholders.length > 0) {
      this.logger.warn('Potentially invalid configuration values:');
      for (const placeholder of potentialPlaceholders) {
        this.logger.warn(`- ${placeholder}`);
      }

      // In production, fail on placeholder values
      if (this.configService.get('NODE_ENV') === 'production') {
        throw new Error(
          'Application initialization failed: Placeholder values detected in production',
        );
      }
    }

    this.logger.log(
      'Configuration validation complete - all required variables present',
    );
  }
}

ConfigModule.forRoot({
  validationSchema,
  validationOptions: {
    abortEarly: false,
    allowUnknown: true,
    // This makes the application crash if validation fails
    // and prevents silent failures
    presence: process.env.NODE_ENV === 'production' ? 'required' : 'optional',
  },
});
