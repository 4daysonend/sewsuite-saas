// /backend/src/email/email.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogService } from '../audit/audit-log.service';
import { SendEmailResponse as SendEmailResponseDto } from './dto/send-email.dto';

interface SendEmailRequest {
  email: string;
}

interface SendEmailResponse {
  message: string;
}

@ApiTags('email')
@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
export class EmailController {
  private readonly logger = new Logger(EmailController.name);
  private isProduction: boolean;
  private testEndpointsEnabled: boolean;

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly auditLogService: AuditLogService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.initializeEnvironmentSettings();
  }

  private initializeEnvironmentSettings(): void {
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    this.testEndpointsEnabled =
      this.configService.get<string>('ENABLE_TEST_ENDPOINTS') === 'true';

    if (this.isProduction && this.testEndpointsEnabled) {
      this.logger.warn(
        'WARNING: Test endpoints are enabled in production environment!',
      );
    }
  }

  @Post('test')
  @Roles('admin')
  @Throttle({ test_email: { limit: 3, ttl: 60 } })
  @ApiOperation({ summary: 'Send test email (development only)' })
  @ApiResponse({
    status: 200,
    description: 'Test email sent successfully',
    type: SendEmailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid email address',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - endpoint disabled in production',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - rate limit exceeded',
  })
  async sendTestEmail(
    @Body() body: SendEmailRequest,
    @Req() request: Request,
  ): Promise<SendEmailResponse> {
    if (this.isProduction && !this.testEndpointsEnabled) {
      const message = 'Test endpoints are disabled in production environment';

      await this.logSecurityEvent({
        userId: (request.user as any)?.id,
        action: 'TEST_ENDPOINT_BLOCKED',
        resource: 'email/test',
        ip: this.getClientIp(request),
        details: {
          message,
          email: body.email,
        },
        severity: 'WARNING',
      });

      this.logger.warn(
        `Blocked test endpoint access in production: ${body.email}`,
      );
      throw new ForbiddenException(message);
    }

    if (!this.isValidEmail(body.email)) {
      const message = 'Invalid email address format';

      await this.logSecurityEvent({
        userId: (request.user as any)?.id,
        action: 'INVALID_EMAIL_FORMAT',
        resource: 'email/test',
        ip: this.getClientIp(request),
        details: {
          message,
          email: body.email,
        },
        severity: 'WARNING',
      });

      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }

    await this.logSecurityEvent({
      userId: (request.user as any)?.id,
      action: 'TEST_EMAIL_SENT',
      resource: 'email/test',
      ip: this.getClientIp(request),
      details: {
        email: body.email,
      },
      severity: 'INFO',
    });

    this.logger.log(
      `Admin user ${(request.user as any)?.email} sending test email to ${body.email}`,
    );

    try {
      await this.emailService.sendEmail({
        to: body.email,
        subject: 'Test Email',
        html:
          '<h1>Test Email</h1>' +
          '<p>This is a test email from SewSuite Platform.</p>' +
          `<p>Sent at: ${new Date().toISOString()}</p>` +
          '<p>This email is for testing purposes only.</p>',
        text:
          'Test Email\n' +
          'This is a test email from SewSuite Platform.\n' +
          `Sent at: ${new Date().toISOString()}\n` +
          'This email is for testing purposes only.',
      });

      return { message: 'Test email sent successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to send test email to ${body.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );

      await this.logSecurityEvent({
        userId: (request.user as any)?.id,
        action: 'TEST_EMAIL_FAILED',
        resource: 'email/test',
        ip: this.getClientIp(request),
        details: {
          email: body.email,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        severity: 'ERROR',
      });

      throw new HttpException(
        'Failed to send test email',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async logSecurityEvent(eventData: {
    userId?: string;
    action: string;
    resource: string;
    ip?: string;
    details?: any;
    severity: 'INFO' | 'WARNING' | 'ERROR';
  }): Promise<void> {
    try {
      let username: string | undefined;
      if (eventData.userId) {
        try {
          const user = await this.userRepository.findOne({
            where: { id: eventData.userId },
            select: ['email'],
          });
          username = user?.email;
        } catch (err) {}
      }

      await this.auditLogService.createAuditLog({
        userId: eventData.userId,
        username,
        action: eventData.action,
        resource: eventData.resource,
        ip: eventData.ip,
        details: eventData.details,
        severity: eventData.severity,
      });
    } catch (error) {
      this.logger.error(
        `Failed to log security event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private getClientIp(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
