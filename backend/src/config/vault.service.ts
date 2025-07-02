// backend/src/config/vault.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

@Injectable()
export class VaultService implements OnModuleInit {
  private readonly logger = new Logger(VaultService.name);
  private secrets: Record<string, string> = {};

  // Implement OnModuleInit to load secrets when the module initializes
  async onModuleInit() {
    await this.loadSecrets();
  }

  async loadSecrets(): Promise<void> {
    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
      this.logger.log(
        'Test environment detected, skipping Vault secrets loading',
      );
      return;
    }

    try {
      // In production, secrets are mounted via Vault Agent
      const tokenDir = process.env.VAULT_TOKEN_PATH || '/vault/token';

      // Files to load
      const secretFiles = ['database.env', 'stripe.env', 'jwt.env', 'api.env'];

      for (const file of secretFiles) {
        const filePath = path.join(tokenDir, file);

        // Check if file exists (it might not if we're in development)
        if (fs.existsSync(filePath)) {
          const envConfig = dotenv.parse(fs.readFileSync(filePath));
          this.logger.log(`Loaded secrets from ${file}`);

          // Add to secrets dictionary
          Object.assign(this.secrets, envConfig);
        } else {
          this.logger.warn(`Secret file ${file} not found at ${filePath}`);
        }
      }

      this.logger.log(
        `Loaded ${Object.keys(this.secrets).length} secrets from Vault`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to load secrets from Vault: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Get a secret value either from Vault or environment variables
   * @param key The secret key to retrieve
   * @returns The secret value or undefined
   */
  getSecret(key: string): string | undefined {
    // First check if it's in our loaded secrets from Vault
    if (this.secrets[key] !== undefined) {
      return this.secrets[key];
    }

    // Fall back to environment variables
    const envValue = process.env[key];
    if (envValue !== undefined) {
      return envValue;
    }

    // In development, provide default values for common secrets
    if (process.env.NODE_ENV === 'development') {
      const devDefaults: Record<string, string> = {
        // Stripe test keys (use your own test keys here)
        STRIPE_PUBLISHABLE_KEY: 'pk_test_example123456',
        STRIPE_SECRET_KEY: 'sk_test_example123456',
        STRIPE_WEBHOOK_SECRET: 'whsec_example123456',

        // JWT defaults for development
        JWT_SECRET: 'dev-jwt-secret-not-for-production',
        JWT_EXPIRATION: '1d',

        // Other development defaults
        FRONTEND_URL: 'http://localhost:3001',
      };

      return devDefaults[key];
    }

    return undefined;
  }

  /**
   * Refresh secrets from Vault
   * This can be called periodically or when a configuration change is detected
   */
  async refreshSecrets(): Promise<void> {
    this.logger.log('Refreshing secrets from Vault');
    await this.loadSecrets();
  }
}
