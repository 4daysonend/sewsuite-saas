import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmailService } from './email.service';

@ApiTags('email')
@Controller('email')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test')
  @Roles('admin')
  @ApiOperation({ summary: 'Send test email' })
  async sendTestEmail(@Body() body: { email: string }) {
    await this.emailService.sendEmail({
      to: body.email,
      subject: 'Test Email',
      html: '<h1>Test Email</h1><p>This is a test email from Tailor Platform.</p>',
      text: 'Test Email\nThis is a test email from Tailor Platform.',
    });
    return { message: 'Test email sent successfully' };
  }
}