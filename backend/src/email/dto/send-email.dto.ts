import { ApiProperty } from '@nestjs/swagger';

export class SendEmailRequest {
  @ApiProperty({
    description: 'Email address to send the test email to',
    example: 'test@example.com',
  })
  email: string;
}

export class SendEmailResponse {
  @ApiProperty({
    description: 'Response message indicating the result of the operation',
    example: 'Test email sent to test@example.com successfully',
  })
  message: string;
}
