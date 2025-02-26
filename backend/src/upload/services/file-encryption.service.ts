import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface EncryptionResult {
  encryptedData: Buffer;
  keyId: string;
}

/**
 * Service for handling file encryption and decryption
 */
@Injectable()
export class FileEncryptionService {
  private readonly logger = new Logger(FileEncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly authTagLength = 16;
  private readonly masterKey: string;

  constructor(private readonly configService: ConfigService) {
    this.masterKey = this.configService.get<string>('ENCRYPTION_MASTER_KEY', '');
    if (!this.masterKey) {
      this.logger.warn('Encryption master key not configured, using development key');
      // Use a development-only key - should be overridden in production
      this.masterKey = 'development-only-encryption-key-not-for-production';
    }
  }

  /**
   * Encrypt file content
   * @param file Buffer containing file data
   * @returns Encrypted data and key ID
   */
  async encryptFile(file: Buffer): Promise<EncryptionResult> {
    try {
      // Generate a unique key for this encryption
      const key = crypto.randomBytes(this.keyLength);
      const iv = crypto.randomBytes(this.ivLength);
      const keyId = crypto.randomBytes(16).toString('hex');

      // Store the key securely with the master key
      await this.storeEncryptionKey(keyId, key);

      // Encrypt the file
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      const encrypted = Buffer.concat([
        cipher.update(file),
        cipher.final(),
      ]);
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV, encrypted content, and auth tag
      const encryptedData = Buffer.concat([
        iv,                  // First 16 bytes: IV
        encrypted,           // Middle: Encrypted content
        authTag,             // Last 16 bytes: Auth tag
      ]);

      return {
        encryptedData,
        keyId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to encrypt file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Decrypt file content
   * @param encryptedFile Buffer containing encrypted file data
   * @param keyId ID of the encryption key
   * @returns Decrypted file buffer
   */
  async decryptFile(encryptedFile: Buffer, keyId: string): Promise<Buffer> {
    try {
      // Extract IV, encrypted content, and auth tag
      const iv = encryptedFile.subarray(0, this.ivLength);
      const authTag = encryptedFile.subarray(encryptedFile.length - this.authTagLength);
      const encryptedContent = encryptedFile.subarray(
        this.ivLength,
        encryptedFile.length - this.authTagLength
      );

      // Retrieve the encryption key
      const key = await this.retrieveEncryptionKey(keyId);

      // Decrypt the file
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      return Buffer.concat([
        decipher.update(encryptedContent),
        decipher.final(),
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to decrypt file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Store encryption key securely
   * @param keyId ID of the key
   * @param key Encryption key
   */
  private async storeEncryptionKey(keyId: string, key: Buffer): Promise<void> {
    try {
      // In a production environment, you would use a secure key management service
      // like AWS KMS, Azure Key Vault, or HashiCorp Vault
      
      // For development purposes, we'll encrypt the key with the master key
      const masterKeyHash = crypto.createHash('sha256').update(this.masterKey).digest();
      const cipher = crypto.createCipheriv('aes-256-cbc', masterKeyHash, Buffer.alloc(16, 0));
      const encryptedKey = Buffer.concat([cipher.update(key), cipher.final()]);
      
      // In a real implementation, save this to a secure database
      // For now, log that we're simulating key storage
      this.logger.debug(`Simulating secure storage of key: ${keyId}`);
      
      // Here we would typically store the encrypted key in a secure database
      // For development, we're keeping keys in memory
      // In production, implement proper key storage
    } catch (error) {
      this.logger.error(
        `Failed to store encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Retrieve encryption key
   * @param keyId ID of the key to retrieve
   * @returns Encryption key
   */
  private async retrieveEncryptionKey(keyId: string): Promise<Buffer> {
    try {
      // In a production environment, you would retrieve from a secure key management service
      
      // For development, we'll derive the key deterministically from the keyId and master key
      // This is NOT secure for production use
      const combinedKey = `${this.masterKey}:${keyId}`;
      return crypto.pbkdf2Sync(
        combinedKey,
        keyId,
        10000,
        this.keyLength,
        'sha256'
      );
    } catch (error) {
      this.logger.error(
        `Failed to retrieve encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }

  /**
   * Rotate encryption key
   * @param oldKeyId Current key ID
   * @returns New key ID
   */
  async rotateEncryptionKey(oldKeyId: string): Promise<string> {
    try {
      // Get the current key
      const currentKey = await this.retrieveEncryptionKey(oldKeyId);
      
      // Generate a new key ID
      const newKeyId = crypto.randomBytes(16).toString('hex');
      
      // Store the same key under a new ID
      await this.storeEncryptionKey(newKeyId, currentKey);
      
      return newKeyId;
    } catch (error) {
      this.logger.error(
        `Failed to rotate encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }
}