import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import * as Joi from 'joi';

const schema = Joi.object({
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().required(),
  // ...
});

export function validateEnv(configService: ConfigService) {
  const validationResult = schema.validate(
    configService.get<Record<string, unknown>>(''),
    {
      allowUnknown: true,
      abortEarly: false,
    },
  );
  if (validationResult.error) {
    throw new Error(`Invalid env config: ${validationResult.error.message}`);
  }
}

/**
 * Environment utility to safely access variables with fallbacks and secret retrieval
 */
export class EnvironmentService {
  private secretsManager: AWS.SecretsManager;
  private cachedSecrets: Record<string, string> = {};

  constructor(private configService: ConfigService) {
    // Initialize AWS Secrets Manager if in production
    if (this.isProd()) {
      this.secretsManager = new AWS.SecretsManager({
        region: this.get('AWS_REGION'),
        accessKeyId: this.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.get('AWS_SECRET_ACCESS_KEY'),
      });
    }

    // Ensure SENTRY_DSN is set in production
    if (this.isProd() && !process.env.SENTRY_DSN) {
      throw new Error('SENTRY_DSN is required in production');
    }
  }

  /**
   * Get environment variable with type safety
   */
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get<T>(key: string, defaultValue?: T): T | undefined {
    const value = this.configService.get<T>(key);
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Safely access environment variable, log warning if not found
   */
  getOrLog(key: string, defaultValue: string = ''): string {
    const value = this.configService.get<string>(key);
    if (!value && defaultValue) {
      console.warn(
        `⚠️ Environment variable ${key} not found, using default value`,
      );
      return defaultValue;
    }
    if (!value) {
      console.warn(
        `⚠️ Environment variable ${key} not found and no default provided`,
      );
    }
    return value || '';
  }

  /**
   * Get a sensitive config value, retrieving from Secrets Manager in production
   */
  async getSecret(key: string, secretId?: string): Promise<string> {
    // In development, use local env vars
    if (!this.isProd()) {
      return this.get(key, '');
    }

    // In production, try to get from AWS Secrets Manager
    try {
      // Use cached value if available
      if (this.cachedSecrets[key]) {
        return this.cachedSecrets[key];
      }

      // Determine which secret to retrieve
      const actualSecretId =
        secretId || this.get('AWS_SECRET_ID', 'sewsuite-secrets');

      const secretData = await this.secretsManager
        .getSecretValue({ SecretId: actualSecretId })
        .promise();

      // Parse the secret JSON
      if (secretData.SecretString) {
        const secrets = JSON.parse(secretData.SecretString);

        // Cache all secrets for future use
        Object.keys(secrets).forEach((secretKey) => {
          this.cachedSecrets[secretKey] = secrets[secretKey];
        });

        // Return the requested secret
        return secrets[key] || this.get(key, '');
      }

      // Fallback to environment variable
      return this.get(key, '');
    } catch (error) {
      console.error(`Error retrieving secret ${key}:`, error);
      // Fallback to environment variable
      return this.get(key, '');
    }
  }

  /**
   * Check if running in production
   */
  isProd(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  /**
   * Get database connection config
   */
  getDatabaseConfig() {
    return {
      host: this.get('POSTGRES_HOST'),
      port: this.get<number>('POSTGRES_PORT'),
      username: this.get('POSTGRES_USER'),
      password: this.get('POSTGRES_PASSWORD'),
      database: this.get('POSTGRES_DB'),
    };
  }

  /**
   * Get S3/MinIO config
   */
  getS3Config() {
    return {
      accessKeyId: this.get('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.get('AWS_SECRET_ACCESS_KEY'),
      region: this.get('AWS_REGION'),
      bucket: this.get('S3_BUCKET_NAME'),
      endpoint: this.get('S3_ENDPOINT', null),
    };
  }

  /**
   * Get JWT config
   */
  async getJwtConfig() {
    const secret = this.isProd()
      ? await this.getSecret('JWT_SECRET')
      : this.get('JWT_SECRET');

    return {
      secret,
      expiresIn: this.get('JWT_EXPIRATION', '24h'),
    };
  }
}
