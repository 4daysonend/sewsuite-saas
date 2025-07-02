import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import logger from '../utils/logger';

/**
 * Configuration for database connections retrieved securely from AWS Secrets Manager
 */
class DatabaseConfig {
  constructor() {
    this.secretsManager = new SecretsManager({
      region: process.env.AWS_REGION || 'us-east-1',
      // Use IAM roles for EC2/ECS or temporary credentials rather than hardcoded keys
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });

    this.environment = process.env.NODE_ENV || 'development';
    this.appName = 'sewsuite';
    this.credentials = {
      postgres: null,
      mongodb: null,
      redis: null,
      queueRedis: null,
    };
  }

  /**
   * Get a secret from AWS Secrets Manager
   * @param {string} secretName - The name of the secret to retrieve
   * @returns {Promise<object>} - The parsed secret value
   */
  async getSecret(secretName) {
    try {
      const secretId = `${this.environment}/${this.appName}/${secretName}`;
      logger.debug(`Retrieving secret: ${secretId}`);

      const response = await this.secretsManager.getSecretValue({
        SecretId: secretId,
      });

      if ('SecretString' in response) {
        return JSON.parse(response.SecretString);
      } else {
        // Handle binary secrets if needed
        const buff = Buffer.from(response.SecretBinary, 'base64');
        return JSON.parse(buff.toString('ascii'));
      }
    } catch (error) {
      logger.error(`Error retrieving secret ${secretName}: ${error.message}`);
      throw new Error(
        `Failed to retrieve secret ${secretName}: ${error.message}`,
      );
    }
  }

  /**
   * Initialize database configurations by loading all required secrets
   */
  async initialize() {
    try {
      logger.info(
        'Initializing database configurations from AWS Secrets Manager',
      );

      // Load all secrets in parallel for efficiency
      const [postgresSecret, mongodbSecret, redisSecret, queueRedisSecret] =
        await Promise.all([
          this.getSecret('postgres'),
          this.getSecret('mongodb'),
          this.getSecret('redis'),
          this.getSecret('queue-redis'),
        ]);

      this.credentials.postgres = postgresSecret;
      this.credentials.mongodb = mongodbSecret;
      this.credentials.redis = redisSecret;
      this.credentials.queueRedis = queueRedisSecret;

      logger.info('Successfully loaded database configurations');
      return true;
    } catch (error) {
      logger.error(
        `Failed to initialize database configurations: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get PostgreSQL connection configuration
   * @returns {object} PostgreSQL connection configuration
   */
  getPostgresConfig() {
    if (!this.credentials.postgres) {
      throw new Error(
        'PostgreSQL credentials not loaded. Call initialize() first.',
      );
    }

    return {
      host: this.credentials.postgres.host,
      port: this.credentials.postgres.port,
      username: this.credentials.postgres.username,
      password: this.credentials.postgres.password,
      database: this.credentials.postgres.database,
      ssl: this.environment === 'production',
    };
  }

  /**
   * Get MongoDB connection configuration
   * @returns {object} MongoDB connection configuration
   */
  getMongoDBConfig() {
    if (!this.credentials.mongodb) {
      throw new Error(
        'MongoDB credentials not loaded. Call initialize() first.',
      );
    }

    const { username, password, host, port, database } =
      this.credentials.mongodb;
    const auth =
      username && password
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        : '';

    return {
      uri: `mongodb://${auth}${host}:${port}/${database}`,
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        ssl: this.environment === 'production',
      },
    };
  }

  /**
   * Get Redis connection configuration
   * @returns {object} Redis connection configuration
   */
  getRedisConfig() {
    if (!this.credentials.redis) {
      throw new Error('Redis credentials not loaded. Call initialize() first.');
    }

    return {
      host: this.credentials.redis.host,
      port: this.credentials.redis.port,
      password: this.credentials.redis.password,
      db: this.credentials.redis.database,
      tls: this.environment === 'production' ? {} : undefined,
    };
  }

  /**
   * Get Queue Redis connection configuration
   * @returns {object} Queue Redis connection configuration
   */
  getQueueRedisConfig() {
    if (!this.credentials.queueRedis) {
      throw new Error(
        'Queue Redis credentials not loaded. Call initialize() first.',
      );
    }

    return {
      host: this.credentials.queueRedis.host,
      port: this.credentials.queueRedis.port,
      password: this.credentials.queueRedis.password,
      db: this.credentials.queueRedis.database,
      tls: this.environment === 'production' ? {} : undefined,
    };
  }
}

// Create a singleton instance
const dbConfig = new DatabaseConfig();

export default dbConfig;
