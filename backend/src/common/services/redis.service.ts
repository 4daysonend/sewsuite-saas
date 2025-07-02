import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Add this at the top of the file or in a separate types file
export enum UserRole {
  ADMIN = 'ADMIN',
  SERVICE = 'SERVICE',
  READONLY = 'READONLY',
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private isConnected = false;
  private securityChecked = false;

  constructor(private readonly configService: ConfigService) {
    const redisConfig = this.getRedisConfig();
    this.client = new Redis(redisConfig);

    this.setupEventListeners();
  }

  async onModuleInit() {
    try {
      // Verify Redis auth explicitly
      if (this.hasPassword()) {
        await this.client.auth(this.getConfigValue('REDIS_PASSWORD', ''));
        // Password might be logged in error stack traces
      }
    } catch (error) {
      if (error instanceof Error && error.message?.includes('WRONGPASS')) {
        this.logger.error(
          'Redis authentication failed - incorrect credentials',
        );
      } else {
        this.logger.error(
          'Failed to connect to Redis during startup',
          error instanceof Error ? error.stack : undefined,
        );
      }
      this.isConnected = false;
    }
  }

  async onModuleDestroy() {
    try {
      // Clean disconnection when application shuts down
      await this.client.quit();
      this.logger.log('Redis connection closed gracefully');
    } catch (error) {
      this.logger.error(
        'Error closing Redis connection',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Get a pipeline for executing multiple commands
   * Improves performance by sending commands in batches
   */
  pipeline(): ReturnType<Redis['pipeline']> {
    return this.client.pipeline();
  }

  /**
   * Check Redis health with a ping
   */
  async ping(): Promise<string> {
    try {
      const result = await this.client.ping();
      this.isConnected = true; // Update connection state
      return result;
    } catch (error) {
      this.isConnected = false; // Update connection state
      this.logger.error(
        'Redis ping failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // Re-throw for health checks to catch
    }
  }

  /**
   * Get value by key
   * @param key Redis key
   * @returns Value or null if not found
   */
  async get(key: string): Promise<string | null> {
    const sanitizedKey = this.sanitizeKey(key);
    try {
      // Log with masked key for sensitive keys
      this.logger.debug(`Getting key: ${this.maskSensitiveKey(key)}`);
      return await this.client.get(sanitizedKey);
    } catch (error) {
      this.handleError('get', error, sanitizedKey);
      return null;
    }
  }

  /**
   * Set a key with optional TTL
   * @param key Redis key
   * @param value Value to store
   * @param ttlSeconds Optional TTL in seconds
   */
  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<'OK' | null> {
    const sanitizedKey = this.sanitizeKey(key);
    const validatedValue = this.validateValue(value);

    // Log the operation but mask the value if sensitive
    this.logger.debug(
      `Setting key: ${sanitizedKey}, value: ${this.maskSensitiveValue(value)}`,
    );

    try {
      if (ttlSeconds) {
        // Validate TTL
        if (ttlSeconds <= 0 || ttlSeconds > 31536000) {
          // 1 year max
          throw new BadRequestException(
            'TTL must be between 1 second and 1 year',
          );
        }
        return await this.client.set(
          sanitizedKey,
          validatedValue,
          'EX',
          ttlSeconds,
        );
      }
      return await this.client.set(sanitizedKey, validatedValue);
    } catch (error) {
      this.handleError('set', error, sanitizedKey);
      return null;
    }
  }

  /**
   * Set a key with optional encryption for sensitive data
   */
  async setSecure(
    key: string,
    value: string,
    options?: {
      ttlSeconds?: number;
      encrypt?: boolean;
    },
  ): Promise<'OK' | null> {
    const sanitizedKey = this.sanitizeKey(key);
    let finalValue = value;

    try {
      // Encrypt sensitive data before storing
      if (options?.encrypt) {
        finalValue = await this.encrypt(value);
      }

      if (options?.ttlSeconds) {
        return await this.client.set(
          sanitizedKey,
          finalValue,
          'EX',
          options.ttlSeconds,
        );
      }
      return await this.client.set(sanitizedKey, finalValue);
    } catch (error) {
      this.handleError('setSecure', error, sanitizedKey);
      return null;
    }
  }

  /**
   * Get and decrypt sensitive data
   */
  async getSecure(
    key: string,
    isEncrypted: boolean = false,
  ): Promise<string | null> {
    const sanitizedKey = this.sanitizeKey(key);
    try {
      const value = await this.client.get(sanitizedKey);
      if (!value || !isEncrypted) return value;

      return await this.decrypt(value);
    } catch (error) {
      this.handleError('getSecure', error, sanitizedKey);
      return null;
    }
  }

  // Encryption helpers (implement with a proper crypto service)
  private async encrypt(value: string): Promise<string> {
    // Get encryption key from secure storage
    const key = Buffer.from(
      this.getConfigValue('REDIS_ENCRYPTION_KEY', ''),
      'hex',
    );
    if (key.length !== 32) {
      this.logger.error('Invalid encryption key length');
      throw new InternalServerErrorException('Encryption configuration error');
    }

    // Create IV for CBC mode
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', key, iv);

    // Encrypt the value
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return IV + encrypted data
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private async decrypt(value: string): Promise<string> {
    // Check if value is in encrypted format
    const parts = value.split(':');
    if (parts.length !== 2) return value;

    try {
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];

      // Get encryption key from secure storage
      const key = Buffer.from(
        this.getConfigValue('REDIS_ENCRYPTION_KEY', ''),
        'hex',
      );
      if (key.length !== 32) {
        throw new Error('Invalid encryption key length');
      }

      // Decrypt
      const decipher = createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error(
        'Decryption failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to decrypt data');
    }
  }

  /**
   * Get list elements by range
   * @param key Redis key
   * @param start Start index
   * @param stop End index (-1 for last element)
   */
  async getListByRange(
    key: string,
    start: number = 0,
    stop: number = -1,
  ): Promise<string[]> {
    const sanitizedKey = this.sanitizeKey(key);
    try {
      return await this.client.lrange(sanitizedKey, start, stop);
    } catch (error) {
      this.handleError('getListByRange', error, sanitizedKey);
      return [];
    }
  }

  /**
   * Add to sorted set with score
   * @param key Redis key
   * @param score Numeric score for sorting
   * @param member Member to add
   */
  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.client.zadd(key, score, member);
    } catch (error) {
      this.handleError('zadd', error, key);
      return 0;
    }
  }

  /**
   * Get sorted set members by score range
   * @param key Redis key
   * @param min Minimum score
   * @param max Maximum score
   */
  async zrangebyscore(
    key: string,
    min: number,
    max: number,
  ): Promise<string[]> {
    try {
      return await this.client.zrangebyscore(key, min, max);
    } catch (error) {
      this.handleError('zrangebyscore', error, key);
      return [];
    }
  }

  /**
   * Increment a key's value
   * @param key Redis key
   */
  async increment(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.handleError('increment', error, key);
      return 0;
    }
  }

  /**
   * Increment with rate limit check
   */
  async incrementWithLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{
    current: number;
    limited: boolean;
    ttl: number;
  }> {
    const sanitizedKey = this.sanitizeKey(key);
    try {
      const pipeline = this.client.pipeline();
      pipeline.incr(sanitizedKey);
      pipeline.ttl(sanitizedKey);

      const results = await pipeline.exec();
      if (!results) throw new Error('Redis pipeline failed');

      const current = results[0][1] as number;
      let ttl = results[1][1] as number;

      // Set expiry if this is first increment
      if (ttl === -1) {
        await this.client.expire(sanitizedKey, windowSeconds);
        ttl = windowSeconds;
      }

      return {
        current,
        limited: current > limit,
        ttl: ttl > 0 ? ttl : windowSeconds,
      };
    } catch (error) {
      this.handleError('incrementWithLimit', error, sanitizedKey);
      return { current: 0, limited: false, ttl: 0 };
    }
  }

  /**
   * Decrement a key's value
   * @param key Redis key
   */
  async decrement(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.handleError('decrement', error, key);
      return 0;
    }
  }

  /**
   * Find keys by pattern (use with caution in production)
   * @param pattern Key pattern to match
   */
  async getKeysByPattern(pattern: string): Promise<string[]> {
    try {
      // Consider using SCAN instead of KEYS in high-volume production environments
      if (this.isProduction()) {
        this.logger.warn(
          `Using KEYS command in production with pattern: ${pattern}`,
        );
      }
      return await this.client.keys(pattern);
    } catch (error) {
      this.handleError('getKeysByPattern', error, pattern);
      return [];
    }
  }

  /**
   * Add members to a set
   * @param key Set key
   * @param members Members to add
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      this.handleError('sadd', error, key);
      return 0;
    }
  }

  /**
   * Remove members from a set
   * @param key Set key
   * @param members Members to remove
   */
  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      this.handleError('srem', error, key);
      return 0;
    }
  }

  /**
   * Get all members of a set
   * @param key Set key
   */
  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.handleError('smembers', error, key);
      return [];
    }
  }

  /**
   * Delete keys
   * @param keys Keys to delete
   */
  async del(...keys: string[]): Promise<number> {
    try {
      this.logger.debug(
        `Deleting key: ${this.maskSensitiveKey(keys.join(', '))}`,
      );
      return await this.client.del(...keys);
    } catch (error) {
      this.handleError('del', error, keys.join(', '));
      return 0;
    }
  }

  /**
   * Set a key's TTL
   * @param key Redis key
   * @param seconds TTL in seconds
   */
  async expire(key: string, seconds: number): Promise<number> {
    // No validation that seconds is a reasonable value
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      this.handleError('expire', error, key);
      return 0;
    }
  }

  /**
   * Get direct Redis client for advanced operations
   * @returns Redis client instance
   */
  getClient(): Redis {
    // Log all direct client access attempts for security auditing
    this.logger.warn('Direct Redis client access requested', new Error().stack);
    return this.client;
  }

  /**
   * Execute Redis command with role-based permissions
   * @param command Redis command
   * @param args Command arguments
   * @param role UserRole
   */
  async executeCommand(
    command: string,
    args: string[],
    role: UserRole,
  ): Promise<any> {
    const normalizedCommand = command.toUpperCase();

    // Use hasPermission here instead of canExecuteCommand
    if (!this.hasPermission(role, normalizedCommand)) {
      throw new ForbiddenException(
        `Unauthorized Redis command: ${normalizedCommand}`,
      );
    }

    // Your existing implementation
    if (this.isHighRiskCommand(normalizedCommand)) {
      this.logger.warn(
        `High-risk Redis command executed: ${normalizedCommand}`,
        {
          role,
          stack: new Error().stack,
        },
      );
    }

    try {
      // Validate args for injection attempts
      const sanitizedArgs = this.sanitizeCommandArgs(args);

      // Execute with tracing for audit logs
      const startTime = Date.now();
      const result = await this.client.call(
        normalizedCommand,
        ...sanitizedArgs,
      );
      const duration = Date.now() - startTime;

      // Log slow commands for performance monitoring
      if (duration > 100) {
        // 100ms threshold
        this.logger.debug(
          `Slow Redis command: ${normalizedCommand} (${duration}ms)`,
        );
      }

      return result;
    } catch (error) {
      this.handleError(normalizedCommand, error, args.join(', '));

      // Rethrow as appropriate exception
      if (
        error instanceof Error &&
        (error.message?.includes('WRONGPASS') ||
          error.message?.includes('NOPERM'))
      ) {
        throw new ForbiddenException('Redis permission denied');
      }

      throw new InternalServerErrorException('Redis command failed');
    }
  }

  /**
   * Check if user role has permission for the specified command
   * @param role User role
   * @param command Redis command
   * @returns Whether the role has permission
   */
  private hasPermission(role: UserRole, command: string): boolean {
    // Define command permissions by role
    const commandPermissions: Record<UserRole, string[]> = {
      [UserRole.ADMIN]: ['*'], // Admins can do anything
      [UserRole.SERVICE]: [
        // All your service permissions
        'GET',
        'MGET' /* etc. */,
      ],
      [UserRole.READONLY]: [
        // All your readonly permissions
        'GET',
        'MGET' /* etc. */,
      ],
    };

    // Special case for admin role - can execute anything
    if (role === UserRole.ADMIN) return true;

    // For other roles, check the specific permissions
    const allowedCommands = commandPermissions[role] || [];
    return allowedCommands.includes(command) || allowedCommands.includes('*'); // Check for wildcard permission
  }

  /**
   * Check if command is considered high-risk
   * @param command Redis command
   * @returns Whether the command is high-risk
   */
  private isHighRiskCommand(command: string): boolean {
    const highRiskCommands = [
      // Global data modification
      'FLUSHDB',
      'FLUSHALL',
      // Security-sensitive
      'CONFIG',
      'AUTH',
      'ACL',
      // Performance-impacting
      'KEYS',
      'SCAN',
      // Scripting
      'EVAL',
      'EVALSHA',
      // Persistence control
      'SAVE',
      'BGSAVE',
      'BGREWRITEAOF',
      // Connection management
      'CLIENT',
      'SHUTDOWN',
      // Debugging
      'MONITOR',
      'DEBUG',
    ];
    return highRiskCommands.includes(command);
  }

  /**
   * Sanitize command arguments to prevent injection attacks
   * @param args Command arguments to sanitize
   * @returns Sanitized arguments
   */
  private sanitizeCommandArgs(args: string[]): string[] {
    // Basic sanitization - you might want to enhance this
    return args.map((arg) => {
      // Prevent script injection - don't allow arguments with specific Redis protocol characters
      if (
        typeof arg === 'string' &&
        (arg.includes('\r') ||
          arg.includes('\n') ||
          (arg.includes('*') && arg.includes('$')))
      ) {
        this.logger.warn(
          `Potentially dangerous Redis argument sanitized: ${arg}`,
        );
        return arg.replace(/[\r\n\*\$]/g, '');
      }
      return arg;
    });
  }

  /**
   * Mask sensitive values in logs
   */
  private maskSensitiveValue(value: string): string {
    if (!value || typeof value !== 'string') {
      return value;
    }

    // Mask potential passwords or tokens
    if (
      value.length > 8 &&
      (/password|token|secret|key|auth|credential/i.test(value) ||
        /^[A-Za-z0-9+/]{20,}={0,2}$/.test(value))
    ) {
      // Likely base64
      return value.substring(0, 3) + '***';
    }

    return value;
  }

  /**
   * Get a namespaced key for role-based access control
   * @param namespace Namespace (e.g., 'user', 'order')
   * @param id Resource identifier
   * @param field Optional field name
   */
  async getNamespacedKey(
    namespace: string,
    id: string,
    field?: string,
    options?: { role: UserRole; ownerId?: string },
  ): Promise<string | null> {
    // Validate namespace
    if (!this.isAllowedNamespace(namespace)) {
      throw new BadRequestException(`Invalid namespace: ${namespace}`);
    }

    // Build key
    const key = field ? `${namespace}:${id}:${field}` : `${namespace}:${id}`;

    // If no options, just return the key
    if (!options) {
      return key;
    }

    // If admin role, allow access to any key
    if (options.role === UserRole.ADMIN) {
      return key;
    }

    // For non-admin roles, verify ownership if ownerId is provided
    if (options.ownerId && options.ownerId !== id && namespace === 'user') {
      // Check if user has access permissions to the resource
      const hasAccess = await this.checkAccessPermission(
        options.ownerId,
        namespace,
        id,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          `Access denied to resource: ${namespace}:${id}`,
        );
      }
    }

    return key;
  }

  /**
   * Check if user has access permission to a resource
   * This would typically connect to your permission system
   */
  private async checkAccessPermission(
    userId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<boolean> {
    // In a real implementation, this would check against your access control system
    // Example implementation for a multi-tenant system:
    try {
      // Check direct ownership
      const ownerKey = `${resourceType}:${resourceId}:owner`;
      const owner = await this.client.get(ownerKey);

      if (owner === userId) {
        return true;
      }

      // Check shared access
      const accessKey = `${resourceType}:${resourceId}:shared_with`;
      const hasAccess = await this.client.sismember(accessKey, userId);

      return hasAccess === 1;
    } catch (error) {
      this.logger.error(
        `Failed to check access permission: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Fail closed - deny access on error
      return false;
    }
  }

  /**
   * Check if namespace is allowed
   * @param key Key or namespace to check
   */
  private isAllowedNamespace(key: string): boolean {
    // Extract namespace from key if it includes a colon
    const namespace = key.includes(':') ? key.split(':')[0] : key;

    // List of allowed namespaces in the system
    const allowedNamespaces = [
      'user', // User data
      'session', // User sessions
      'token', // Authentication tokens
      'order', // Customer orders
      'product', // Product data
      'file', // File metadata
      'quota', // User quotas
      'settings', // Application settings
      'cache', // Cache data
      'metric', // Metrics and counters
      'job', // Background jobs
      'notification', // User notifications
      'rate_limit', // Rate limiting
      'temp', // Temporary data
    ];

    return allowedNamespaces.includes(namespace);
  }

  /**
   * Set up Redis connection event listeners
   */
  private setupEventListeners() {
    this.client.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Connected to Redis server');
    });

    this.client.on('error', (error) => {
      // Don't set isConnected to false on error - just log it
      // Redis might recover
      this.logger.error(`Redis error: ${error.message}`, error.stack);
    });

    this.client.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Disconnected from Redis server');
    });

    // Monitor for suspicious activity
    this.client.on('ready', () => {
      this.logger.log('Redis server ready');
      // Verify server configuration for security
      this.checkRedisSecurityConfig().catch((err) =>
        this.logger.warn('Redis security check failed', err),
      );
    });
  }

  /**
   * Check Redis server security configuration
   */
  private async checkRedisSecurityConfig(): Promise<void> {
    try {
      // Only run in non-production first boot
      if (this.isProduction() || this.securityChecked) return;
      // This means security checks aren't run in production!
    } catch (error) {
      // Graceful fallback if checks fail (might not have permission)
      this.logger.debug(
        'Redis security checks skipped - insufficient permissions',
      );
    }
  }

  /**
   * Check if Redis has appropriate security settings
   */
  async validateSecuritySettings(): Promise<boolean> {
    if (!this.isProduction()) return true;

    // Add security checks for production
    const tlsEnabled = await this.isTlsEnabled();
    const passwordSet = this.hasPassword();
    const noExposedCommands = !(await this.hasExposedCommands());

    return tlsEnabled && passwordSet && noExposedCommands;
  }

  private async isTlsEnabled(): Promise<boolean> {
    // In real implementation, check actual connection properties
    return (
      !!this.configService.get<boolean>('REDIS_TLS_ENABLED') ||
      process.env.REDIS_TLS_ENABLED === 'true'
    );
  }

  private async hasExposedCommands(): Promise<boolean> {
    try {
      // Check if dangerous commands are disabled
      const result = await this.client.call(
        'COMMAND',
        'LIST',
        'FILTERBY',
        'CATEGORY',
        'dangerous',
      );
      // If we got results, these commands are enabled
      return Array.isArray(result) && result.length > 0;
    } catch {
      // If command fails, we can't determine - assume the worst
      return true;
    }
  }

  /**
   * Handle Redis errors with detailed logging
   * @param command The command that failed
   * @param error The error that was thrown
   * @param args The arguments passed to the command (could be null)
   */
  private handleError(
    command: string,
    error: unknown,
    args: string | null,
  ): void {
    // Safe way to handle potentially null args
    const argsDisplay = args === null ? 'null' : args;

    if (error instanceof Error) {
      this.logger.error(
        `Redis command error: ${command} ${argsDisplay} - ${error.message}`,
        error.stack,
      );
    } else {
      this.logger.error(
        `Redis command error: ${command} ${argsDisplay} - Unknown error`,
      );
    }
  }

  /**
   * Masks sensitive parts of Redis keys for logging
   * @param key The Redis key to mask
   * @returns A masked version of the key if sensitive
   */
  private maskSensitiveKey(key: string | null): string {
    // Handle null or undefined values
    if (!key) return 'null';

    if (
      key.includes('session:') ||
      key.includes('auth:') ||
      key.includes('token:') ||
      key.includes('secret:') ||
      key.includes('password:')
    ) {
      // Show only the prefix and first few chars
      const parts = key.split(':');
      if (parts.length > 1 && parts[1].length > 4) {
        return `${parts[0]}:${parts[1].substring(0, 4)}...`;
      }
    }
    return key;
  }

  /**
   * Get Redis configuration from ConfigService or environment
   */
  private getRedisConfig(): RedisOptions {
    // Mask sensitive info in logs
    const host = this.getConfigValue('REDIS_HOST', 'localhost');
    const port = parseInt(this.getConfigValue('REDIS_PORT', '6379'), 10);
    const password = this.getConfigValue('REDIS_PASSWORD', '');
    const tls = this.getConfigValue('REDIS_TLS', 'false') === 'true';

    // Log only connection details without credentials
    this.logger.log(`Configuring Redis connection to ${host}:${port}`);

    const options: RedisOptions = {
      host,
      port,
      password: password || undefined,
      // Other options
    };

    // Add TLS if enabled with proper security settings
    if (tls) {
      options.tls = {
        rejectUnauthorized: this.isProduction(), // Enforce cert validation in production
        ca: this.getConfigValue('REDIS_CA_CERT', '') || undefined,
        cert: this.getConfigValue('REDIS_CLIENT_CERT', '') || undefined,
        key: this.getConfigValue('REDIS_CLIENT_KEY', '') || undefined,
      };
    }

    return options;
  }

  // Helper to avoid exposing sensitive values in stack traces
  private getConfigValue(key: string, defaultValue: string): string {
    const value =
      this.configService.get<string>(key) || process.env[key] || defaultValue;
    // If logging, mask sensitive values
    if (
      key.includes('PASSWORD') ||
      key.includes('KEY') ||
      key.includes('SECRET')
    ) {
      this.logger.debug(
        `Config loaded: ${key}=${this.maskSensitiveValue(value)}`,
      );
    }
    return value;
  }

  /**
   * Check if running in production environment
   */
  private isProduction(): boolean {
    const nodeEnv =
      this.configService.get<string>('NODE_ENV') || process.env.NODE_ENV;
    return nodeEnv === 'production';
    // Security shouldn't depend only on environment flag
  }

  // Add a public method to check connection status
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  private hasPassword(): boolean {
    return !!this.getConfigValue('REDIS_PASSWORD', '');
  }

  /**
   * Validate and sanitize Redis key to prevent injection
   */
  private sanitizeKey(key: string): string {
    if (!key || typeof key !== 'string') {
      throw new BadRequestException('Invalid Redis key');
    }

    // Prevent namespace injection attacks
    if (key.includes(':') && !this.isAllowedNamespace(key)) {
      throw new BadRequestException('Invalid key namespace');
    }

    // Maximum key length check
    if (key.length > 1024) {
      throw new BadRequestException('Redis key too long');
    }

    return key;
  }

  private validateValue(value: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('Redis value must be a string');
    }

    // Check for maximum size (Redis defaults to 512MB, but set a reasonable limit)
    const MAX_VALUE_SIZE = 10 * 1024 * 1024; // 10MB
    if (Buffer.byteLength(value, 'utf8') > MAX_VALUE_SIZE) {
      throw new BadRequestException(
        `Redis value exceeds maximum size of ${MAX_VALUE_SIZE} bytes`,
      );
    }

    return value;
  }

  async getUserData(
    userId: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<any> {
    // Check permission - only self or admin can access user data
    if (userId !== currentUser.id && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Cannot access other user data');
    }

    const key = await this.getNamespacedKey('user', userId, 'profile');
    if (key === null) {
      return null;
    }
    return this.get(key);
  }

  async checkRateLimit(
    ip: string,
    endpoint: string,
    limit = 100,
    windowSeconds = 60,
  ): Promise<{ allowed: boolean; remaining: number }> {
    // Use service role for rate limiting operations
    const key = `rate_limit:${ip}:${endpoint}`;

    // Execute command with service role
    const result = await this.executeCommand('INCR', [key], UserRole.SERVICE);

    const count = result as number;

    // Set expiry on first request
    if (count === 1) {
      await this.executeCommand(
        'EXPIRE',
        [key, windowSeconds.toString()],
        UserRole.SERVICE,
      );
    }

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
    };
  }

  async flushUserCache(adminUser: { role: UserRole }): Promise<void> {
    // This is a high-risk operation that requires ADMIN role
    if (adminUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can flush cache');
    }

    const keys = await this.executeCommand(
      'KEYS',
      ['cache:user:*'],
      UserRole.ADMIN,
    );

    if (keys.length > 0) {
      await this.executeCommand('DEL', keys, UserRole.ADMIN);
    }
  }
}
