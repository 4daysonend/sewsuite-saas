// /backend/src/email/email.controller.ts
import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmailService } from './email.service';

interface SendEmailRequest {
  email: string;
}

interface SendEmailResponse {
  message: string;
}

@ApiTags('email')
@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test')
  @Roles('admin')
  @ApiOperation({ summary: 'Send test email' })
  @ApiResponse({ 
    status: 200, 
    description: 'Test email sent successfully',
    type: 'SendEmailResponse'
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid email address' 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized' 
  })
  async sendTestEmail(@Body() body: SendEmailRequest): Promise<SendEmailResponse> {
    await this.emailService.sendEmail({
      to: body.email,
      subject: 'Test Email',
      html: '<h1>Test Email</h1><p>This is a test email from Tailor Platform.</p>',
      text: 'Test Email\nThis is a test email from Tailor Platform.',
    });
    
    return { message: 'Test email sent successfully' };
  }
}